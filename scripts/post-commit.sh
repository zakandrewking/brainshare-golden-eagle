#!/bin/sh

echo "Running post-commit hook..."

# Navigate to the frontend directory
# Assuming this script is run from the root of the repository
if [ -d "frontend" ]; then
  cd frontend || {
    echo "Failed to navigate to frontend directory. Aborting post-commit hook."
    exit 1
  }
else
  # If the script is already in a place where 'frontend' is not a subdirectory (e.g. if linked from .git/hooks)
  # and the CWD is already frontend, this part might need adjustment or a more robust way to find 'frontend'.
  # For now, assuming the script is at repo_root/scripts/ and hook will be run from repo_root.
  # If .git/hooks/post-commit is a symlink to this script, `cd frontend` should work if commit is from repo root.
  # If CWD for hooks is .git/, then path needs to be `cd ../frontend`.
  # Git runs hooks from the root of the working tree. So `cd frontend` should be fine.
  echo "frontend directory not found from current location ($(pwd)). Assuming already in frontend or script needs adjustment."
  # Attempt to check if package.json exists in current dir as a fallback
  if [ ! -f "package.json" ]; then
    echo "package.json not found in current directory. npm commands might fail."
    # exit 1 # Optionally exit if not confident
  fi
fi


echo "Running tests..."
npm test &
test_pid=$!

echo "Running build..."
npm run build &
build_pid=$!

test_status=0
build_status=0

wait $test_pid
test_status=$?

wait $build_pid
build_status=$?

echo # Newline for better formatting

if [ $test_status -ne 0 ] && [ $build_status -ne 0 ]; then
  echo "--------------------------------------"
  echo "🔴 POST-COMMIT HOOK FAILED:"
  echo " - npm test failed (exit code $test_status)"
  echo " - npm run build failed (exit code $build_status)"
  echo "--------------------------------------"
  exit 1
elif [ $test_status -ne 0 ]; then
  echo "--------------------------------------"
  echo "🔴 POST-COMMIT HOOK FAILED:"
  echo " - npm test failed (exit code $test_status)"
  echo "--------------------------------------"
  exit 1
elif [ $build_status -ne 0 ]; then
  echo "--------------------------------------"
  echo "🔴 POST-COMMIT HOOK FAILED:"
  echo " - npm run build failed (exit code $build_status)"
  echo "--------------------------------------"
  exit 1
else
  echo "--------------------------------------"
  echo "✅ POST-COMMIT HOOK SUCCEEDED:"
  echo " - npm test passed"
  echo " - npm run build passed"
  echo "--------------------------------------"
fi

exit 0
