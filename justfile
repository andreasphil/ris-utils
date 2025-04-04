# Frontend ------------------------------------------------

# Run frontend
[group: "frontend", working-directory: "frontend"]
frontend:
  node --run dev

# Build frontend
[group: "frontend", working-directory: "frontend"]
frontend-build:
  node --run build

# Run unit tests in watch mode
[group: "frontend", working-directory: "frontend"]
frontend-test-watch:
  node --run test:watch

# Run E2E test UI
[group: "frontend", working-directory: "frontend"]
frontend-test-e2e-ui:
  node --run test:e2e -- --ui

# Backend -------------------------------------------------

# Run backend without automatic rebuilding
[group: "backend", working-directory: "backend"]
backend params='':
  ./gradlew clean bootRun {{params}}

# Run backend with automatic rebuilding
[group: "backend", working-directory: "backend"]
backend-watch:
  tmux new-session -d -s backend-watch "just backend-build --continuous"
  tmux split-window -h -t backend-watch "./gradlew bootRun"
  tmux attach -t backend-watch

# Run a build without performing additional checks
[group: "backend", working-directory: "backend"]
backend-build params='':
  ./gradlew build -x test -x integrationTest -x checkstyleMain -x spotlessJavaCheck -x spotlessPropertiesCheck -x spotlessMiscCheck {{params}}

# Run integration tests in watch mode
[group: "backend", working-directory: "backend"]
backend-test-integration-watch tests='"*"' params='':
  ./gradlew integrationTest --continuous --tests {{tests}} {{params}}

# Run integration tests once
[group: "backend", working-directory: "backend"]
backend-test-integration tests='"*"':
  ./gradlew integrationTest --tests {{tests}}

# Run unit tests in watch mode
[group: "backend", working-directory: "backend"]
backend-test-watch tests='"*"' params='':
  ./gradlew test --continuous --tests {{tests}} {{params}}

# Run unit tests once
[group: "backend", working-directory: "backend"]
backend-test tests='"*"' params='':
  ./gradlew test --tests {{tests}} {{params}}

# Format backend code
[group: "backend", working-directory: "backend"]
backend-format:
  ./gradlew spotlessApply

# API -----------------------------------------------------

[group: "api"]
login username="jane.doe" password="test":
  #!/bin/zsh
  echo "Logging in ..."
  token="$(http --form POST localhost:8443/realms/ris/protocol/openid-connect/token \
      grant_type=password \
      client_id=ris-norms-local \
      client_secret=ris-norms-local \
      username={{username}} \
      password={{password}} | jq .access_token -r)"

  if [[ $token == "null" ]] then
    echo "Failed to get a token."
    exit 1
  fi

  echo "Done. Testing ..."

  http --session=ris-norms -A bearer -a $token localhost:8080/environment
  echo "Done."

[group: "api"]
create-announcement xmlpath force='true':
  http --session=ris-norms -f POST localhost:8080/api/v1/verkuendungen file@"{{xmlpath}};type=text/xml" force={{force}}

[group: "api", working-directory: "frontend"]
create-samples:
  node --run test:e2e -- --project=setup-chromium

# Infra ---------------------------------------------------

# Tear down and re-create Docker images
[group: "infra"]
rebuild-docker:
  docker compose down
  docker image rm $(docker image ls --filter "reference=ris-norms-app" --format json | jq -r .ID)
  docker compose up -d

# Start services
[group: "infra"]
services:
  docker compose -f docker-compose-services.yaml up -d

# Stop services
[group: "infra"]
services-stop:
  docker compose -f docker-compose-services.yaml down

# Remove the volume that contains the database data (services must be stopped first)
[group: "infra"]
wipe-db: services-stop
  docker volume rm ris-norms_postgres14-data

# Util ----------------------------------------------------

# List all error URIs
[group: "util", working-directory: "backend/src/main"]
list-error-uris:
  rg --only-matching --no-filename --no-line-number --no-heading -e '"\/errors\/.+"' | sort | uniq

# Refresh all GUIDs in the specified XML file
[group: "util"]
bump-guids xmlpath:
  deno run -RW ~/Projects/ris-utils/bump-guids.ts {{xmlpath}}

