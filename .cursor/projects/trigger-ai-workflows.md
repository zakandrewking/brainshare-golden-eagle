# Trigger.dev AI Workflows Integration Project Plan

## Project Overview
Integrate Trigger.dev to manage long-running AI workflows in the background, enabling better handling of complex AI operations, retries, and monitoring.

## Current State Analysis
- Next.js application with AI integration
- Direct API calls to AI services
- No background job processing
- No workflow management
- No retry mechanisms for failed AI operations
- Limited visibility into AI operation status

## Goals
- [ ] Set up Trigger.dev integration
- [ ] Migrate existing AI operations to background jobs
- [ ] Implement workflow management
- [ ] Add retry mechanisms
- [ ] Create monitoring and logging
- [ ] Improve user experience with job status updates

## Phase 1: Trigger.dev Setup (1 week)

### 1.1 Infrastructure Setup
- [ ] Create Trigger.dev account
- [ ] Set up environment variables:
  - `TRIGGER_API_KEY`
  - `TRIGGER_API_URL`
  - `TRIGGER_ENVIRONMENT`
- [ ] Install Trigger.dev dependencies
- [ ] Configure webhook endpoints

### 1.2 Basic Configuration
```typescript
// trigger.config.ts
import { TriggerClient } from "@trigger.dev/sdk";

export const client = new TriggerClient({
  id: "brainshare-ai",
  apiKey: process.env.TRIGGER_API_KEY!,
  apiUrl: process.env.TRIGGER_API_URL,
});
```

## Phase 2: Job Definitions (2 weeks)

### 2.1 AI Operation Jobs
```typescript
// jobs/ai-operations.ts
import { client } from "../trigger.config";
import { generateTableSuggestions } from "../ai/generate-table-suggestions";
import { generateColumnSuggestions } from "../ai/generate-column-suggestions";
import { generateRowSuggestions } from "../ai/generate-row-suggestions";

export const tableSuggestionsJob = client.defineJob({
  id: "table-suggestions",
  name: "Generate Table Suggestions",
  version: "1.0.0",
  trigger: client.defineTrigger({
    id: "table-suggestions-trigger",
    name: "Table Suggestions Trigger",
  }),
  run: async (payload, io) => {
    const { tableId, context } = payload;

    // Run with retries and logging
    return await io.runTask("generate-suggestions", async () => {
      return generateTableSuggestions(tableId, context);
    });
  },
});

// Similar jobs for column and row suggestions
```

### 2.2 Workflow Definitions
```typescript
// workflows/table-generation.ts
import { client } from "../trigger.config";
import { tableSuggestionsJob } from "../jobs/ai-operations";
import { columnSuggestionsJob } from "../jobs/ai-operations";
import { rowSuggestionsJob } from "../jobs/ai-operations";

export const tableGenerationWorkflow = client.defineWorkflow({
  id: "table-generation",
  name: "Table Generation Workflow",
  version: "1.0.0",
  trigger: client.defineTrigger({
    id: "table-generation-trigger",
    name: "Table Generation Trigger",
  }),
  run: async (payload, io) => {
    const { tableId, context } = payload;

    // Run jobs in sequence
    const tableSuggestions = await io.runJob(tableSuggestionsJob, {
      tableId,
      context,
    });

    const columnSuggestions = await io.runJob(columnSuggestionsJob, {
      tableId,
      context: { ...context, tableSuggestions },
    });

    const rowSuggestions = await io.runJob(rowSuggestionsJob, {
      tableId,
      context: { ...context, tableSuggestions, columnSuggestions },
    });

    return {
      tableSuggestions,
      columnSuggestions,
      rowSuggestions,
    };
  },
});
```

## Phase 3: Frontend Integration (2 weeks)

### 3.1 Job Status Management
```typescript
// stores/jobStore.ts
import { create } from "zustand";

interface JobState {
  activeJobs: Map<string, JobStatus>;
  addJob: (jobId: string, status: JobStatus) => void;
  updateJob: (jobId: string, status: JobStatus) => void;
  removeJob: (jobId: string) => void;
}

export const useJobStore = create<JobState>((set) => ({
  activeJobs: new Map(),
  addJob: (jobId, status) =>
    set((state) => ({
      activeJobs: new Map(state.activeJobs).set(jobId, status),
    })),
  updateJob: (jobId, status) =>
    set((state) => ({
      activeJobs: new Map(state.activeJobs).set(jobId, status),
    })),
  removeJob: (jobId) =>
    set((state) => {
      const newJobs = new Map(state.activeJobs);
      newJobs.delete(jobId);
      return { activeJobs: newJobs };
    }),
}));
```

### 3.2 UI Components
- [ ] Create job status indicator component
- [ ] Add job progress visualization
- [ ] Implement job cancellation UI
- [ ] Add job history view

## Phase 4: API Integration (1 week)

### 4.1 API Routes
```typescript
// app/api/ai/route.ts
import { NextResponse } from "next/server";
import { client } from "@/trigger.config";
import { tableGenerationWorkflow } from "@/workflows/table-generation";

export async function POST(req: Request) {
  const { tableId, context } = await req.json();

  const job = await client.sendEvent({
    name: "table-generation-trigger",
    payload: { tableId, context },
  });

  return NextResponse.json({ jobId: job.id });
}
```

### 4.2 Webhook Handlers
```typescript
// app/api/webhooks/trigger/route.ts
import { NextResponse } from "next/server";
import { client } from "@/trigger.config";

export async function POST(req: Request) {
  const payload = await req.json();

  // Handle webhook events
  await client.handleWebhook(payload);

  return NextResponse.json({ success: true });
}
```

## Phase 5: Monitoring and Logging (1 week)

### 5.1 Monitoring Setup
- [ ] Configure Trigger.dev monitoring
- [ ] Set up error tracking
- [ ] Implement performance monitoring
- [ ] Create alerting rules

### 5.2 Logging Implementation
```typescript
// utils/logger.ts
import { client } from "@/trigger.config";

export const logger = {
  info: (message: string, data?: any) => {
    client.log.info(message, data);
  },
  error: (message: string, error?: any) => {
    client.log.error(message, error);
  },
  warn: (message: string, data?: any) => {
    client.log.warn(message, data);
  },
};
```

## Technical Implementation Details

### Job Status Types
```typescript
type JobStatus = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress?: number;
  result?: any;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
};
```

### Error Handling
```typescript
// utils/error-handling.ts
export class AIJobError extends Error {
  constructor(
    message: string,
    public jobId: string,
    public retryable: boolean = true
  ) {
    super(message);
    this.name = "AIJobError";
  }
}

export const handleJobError = async (error: Error, jobId: string) => {
  if (error instanceof AIJobError && error.retryable) {
    // Implement retry logic
    return await retryJob(jobId);
  }

  // Handle non-retryable errors
  await markJobFailed(jobId, error.message);
};
```

## Risk Mitigation

1. **Job Reliability**
   - Implement retry mechanisms
   - Add error handling
   - Set up monitoring
   - Create backup strategies

2. **Performance**
   - Monitor job execution times
   - Implement rate limiting
   - Optimize resource usage
   - Set up auto-scaling

3. **Data Consistency**
   - Implement idempotency
   - Add data validation
   - Create rollback procedures
   - Monitor data integrity

## Timeline and Resources

- Total estimated time: 7 weeks
- Required resources:
  - 2 developers
  - 1 DevOps engineer
  - 1 QA engineer

## Success Criteria

1. All AI operations running as background jobs
2. Reliable job execution with retries
3. Clear job status visibility
4. Proper error handling and logging
5. Improved user experience
6. Comprehensive monitoring

## Next Steps

1. Review and approve this project plan
2. Set up Trigger.dev account
3. Begin Phase 1 with basic configuration
4. Create detailed technical specifications for each phase
