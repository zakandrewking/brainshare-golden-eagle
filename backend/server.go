package main

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

const (
	maxChunkRows    = 1000 // Example: chunk every 1000 rows
	maxChunkColumns = 50   // Example: chunk every 50 columns
)

var s3BucketName string
var s3Client *s3.Client // Make S3 client global for reuse

func main() {
	// Load .env file. Ignore error if it doesn't exist (might rely on system env vars)
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found, relying on system environment variables")
	}

	s3BucketName = os.Getenv("AWS_S3_BUCKET")
	awsRegion := os.Getenv("AWS_REGION")

	if s3BucketName == "" {
		log.Fatal("AWS_S3_BUCKET environment variable not set.")
	}
	if awsRegion == "" {
		log.Fatal("AWS_REGION environment variable not set.")
	}

	// Initialize S3 client once
	cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion(awsRegion))
	if err != nil {
		log.Fatalf("Failed to load AWS config: %v", err)
	}
	s3Client = s3.NewFromConfig(cfg)

	http.HandleFunc("/upload", uploadHandler)
	http.HandleFunc("/health", healthCheckHandler)

	fmt.Println("Server starting on port 8086...")
	if err := http.ListenAndServe(":8086", nil); err != nil {
		log.Fatalf("Could not start server: %s\n", err.Error())
	}
}

func uploadHandler(w http.ResponseWriter, r *http.Request) {
	// 1. Parse multipart form, allowing for files up to 100MB
	if err := r.ParseMultipartForm(100 << 20); err != nil {
		http.Error(w, fmt.Sprintf("Could not parse multipart form: %v", err), http.StatusBadRequest)
		return
	}

	// 2. Retrieve file from posted form-data
	file, handler, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Invalid file key in request", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// 3. Validate file type - check extension and MIME type (optional but recommended)
	if !strings.HasSuffix(strings.ToLower(handler.Filename), ".csv") {
		http.Error(w, "Invalid file type. Only CSV files are allowed.", http.StatusBadRequest)
		return
	}
	// Optional: More robust MIME type checking if needed

	// 4. Retrieve docId from form data
	docIdStr := r.FormValue("docId")
	if docIdStr == "" {
		http.Error(w, "Missing 'docId' in form data", http.StatusBadRequest)
		return
	}

	// 5. Validate docId is a valid UUID
	docId, err := uuid.Parse(docIdStr)
	if err != nil {
		http.Error(w, fmt.Sprintf("Invalid docId format: %v", err), http.StatusBadRequest)
		return
	}

	log.Printf("Received file: %s, Size: %d, docId: %s\n", handler.Filename, handler.Size, docId.String())

	// 6. Read the entire CSV content first (consider streaming for very large files)
	csvReader := csv.NewReader(file)
	// If you expect fields with varying numbers of columns, uncomment the next line
	// csvReader.FieldsPerRecord = -1
	records, err := csvReader.ReadAll()
	if err != nil {
		http.Error(w, fmt.Sprintf("Error reading CSV data: %v", err), http.StatusInternalServerError)
		return
	}

	if len(records) == 0 {
		http.Error(w, "CSV file is empty", http.StatusBadRequest)
		return
	}

	numRows := len(records)
	numCols := len(records[0]) // Assuming consistent number of columns based on header

	log.Printf("CSV dimensions: %d rows x %d columns", numRows, numCols)

	// 7. S3 client is now initialized globally in main()

	// 8. Chunk and Upload
	var header []string
	if numRows > 0 {
		header = records[0]
	}

	for rowStart := 0; rowStart < numRows; rowStart += maxChunkRows {
		rowEnd := rowStart + maxChunkRows
		if rowEnd > numRows {
			rowEnd = numRows
		}

		for colStart := 0; colStart < numCols; colStart += maxChunkColumns {
			colEnd := colStart + maxChunkColumns
			if colEnd > numCols {
				colEnd = numCols
			}

			// Create chunk data (including header for context)
			chunkData := [][]string{}
			if len(header) > 0 && colStart < len(header) {
				actualHeaderColEnd := min(colEnd, len(header))
				chunkHeader := header[colStart:actualHeaderColEnd]
				chunkData = append(chunkData, chunkHeader)
			}

			dataRowStartIndex := 0
			if len(header) > 0 && rowStart == 0 {
				dataRowStartIndex = 1 // Start reading data from row 1 if header exists
			}

			for i := rowStart + dataRowStartIndex; i < rowEnd; i++ {
				if i >= len(records) { // Boundary check for rows
					break
				}
				row := records[i]
				actualColEnd := min(colEnd, len(row))

				if colStart >= actualColEnd {
					chunkData = append(chunkData, []string{}) // Append empty slice if no columns in range for this row
				} else {
					chunkData = append(chunkData, row[colStart:actualColEnd])
				}
			}

			// Skip empty chunks (only header or nothing)
			if (len(chunkData) == 0) || (len(chunkData) == 1 && len(header) > 0 && colStart < len(header)) {
				continue
			}

			// Convert chunk data back to CSV format in memory
			buffer := &bytes.Buffer{}
			csvWriter := csv.NewWriter(buffer)
			if err := csvWriter.WriteAll(chunkData); err != nil {
				log.Printf("Error writing chunk to buffer for row %d-%d, col %d-%d: %v", rowStart, rowEnd, colStart, colEnd, err)
				continue // Log and skip this chunk
			}

			// Define S3 key (using 0-based indexing for rows/cols)
			// Row indices are based on the original file, excluding the header row if present.
			dataRowStart := rowStart
			dataRowEnd := rowEnd
			if len(header) > 0 {
				dataRowStart = max(0, rowStart) // Data rows start from 0 index after header
				dataRowEnd = max(0, rowEnd - 1)
			}
			s3Key := fmt.Sprintf("%s/rows_%d-%d_cols_%d-%d.csv", docId.String(), dataRowStart, dataRowEnd, colStart, colEnd)

			// Upload to S3 using the global client
			_, err = s3Client.PutObject(context.TODO(), &s3.PutObjectInput{
				Bucket: aws.String(s3BucketName), // Use variable loaded from env
				Key:    aws.String(s3Key),
				Body:   buffer,
			})
			if err != nil {
				log.Printf("Failed to upload chunk %s: %v", s3Key, err)
				http.Error(w, fmt.Sprintf("Failed to upload chunk %s: %v", s3Key, err), http.StatusInternalServerError)
				return // Stop on first S3 upload error
			}
			log.Printf("Successfully uploaded chunk: %s", s3Key)
		}
	}

	fmt.Fprintf(w, "File '%s' for docId '%s' processed and chunks uploaded successfully.", handler.Filename, docId.String())
}

// healthCheckHandler responds to health check requests
func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "{\"status\": \"ok\"}")
	w.Header().Set("Content-Type", "application/json") // Set content type
}

// Helper function (optional, could be inline)
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
