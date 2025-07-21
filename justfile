alias f := frontend
alias ft := f-test
alias b := backend
alias bc := backend-clean
alias bitw := b-integration-test-w
alias btw := b-test-w
alias bf := b-format
alias s := services

default:
  just --list

# Frontend ------------------------------------------------

# Run frontend
[group('frontend'), working-directory('frontend')]
frontend:
  node --run dev

# Run unit tests in watch mode
[group('frontend'), working-directory('frontend')]
f-test:
  node --run test:watch

# Run E2E test UI
[group('frontend'), working-directory('frontend')]
e2e:
  node --run test:e2e -- --ui

# Backend -------------------------------------------------

# Run backend without automatic rebuilding, including E2E test seeds
[group('backend'), working-directory('backend')]
backend params='':
  ./gradlew clean bootRun --args='--spring.profiles.active=local,e2e' {{params}}

# Run backend without automatic rebuilding
[group('backend'), working-directory('backend')]
backend-no-seeds params='':
  ./gradlew clean bootRun {{params}}

[group('backend')]
backend-clean: wipe-db backend

# Run backend with automatic rebuilding
[group('backend'), working-directory('backend')]
backend-w:
  tmux new-session -d -s backend-watch "just b-build-unchecked --continuous"
  tmux split-window -h -t backend-watch "./gradlew bootRun"
  tmux attach -t backend-watch

# Run a build without performing additional checks
[group('backend'), working-directory('backend')]
b-build-unchecked params='':
  ./gradlew build -x test -x integrationTest -x checkstyleMain -x spotlessJavaCheck -x spotlessPropertiesCheck -x spotlessMiscCheck {{params}}

# Run integration tests once
[group('backend'), working-directory('backend')]
b-integration-test tests='"*"' params='':
  ./gradlew integrationTest --tests {{tests}} {{params}}

# Run integration tests in watch mode
[group('backend'), working-directory('backend')]
b-integration-test-w tests='"*"' params='':
  ./gradlew integrationTest --continuous --tests {{tests}} {{params}}

# Run unit tests once
[group('backend'), working-directory('backend')]
b-test tests='"*"' params='':
  ./gradlew test --tests {{tests}} {{params}}

# Run unit tests in watch mode
[group('backend'), working-directory('backend')]
b-test-w tests='"*"' params='':
  ./gradlew test --continuous --tests {{tests}} {{params}}

# Serve the test reports
[group('backend'), working-directory('backend/build/reports/tests')]
b-test-report:
  npx servor --reload

# Format backend code
[group('backend'), working-directory('backend')]
b-format:
  ./gradlew spotlessApply

# API -----------------------------------------------------

# Create a new session to use with httpie
[group('api')]
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

# Upload an XML
[group('api')]
create-announcement xmlpath force='true':
  #!/bin/zsh
  set -ueEo pipefail
  cd {{xmlpath}}
  zip -r temp.zip *
  http --session-read-only=ris-norms -f POST localhost:8080/api/v1/verkuendungen file@temp.zip force={{force}} Accept:application/json
  rm temp.zip

# Create sample data
[group('api'), working-directory('frontend')]
create-samples: login
  just create-announcement frontend/e2e/testData/aenderungsgesetz-with-amended-norm-expressions
  just create-announcement frontend/e2e/testData/aenderungsgesetz-with-orphaned-amended-norm-expressions
  just create-announcement LegalDocML.de/1.8.1/samples/bgbl-1_1001_2_mods_01/aenderungsgesetz
  just create-announcement LegalDocML.de/1.8.1/samples/bgbl-1_1002_2_mods-subsitution_01/aenderungsgesetz
  just create-announcement LegalDocML.de/1.8.1/samples/bgbl-1_2017_s419/aenderungsgesetz
  just create-announcement LegalDocML.de/1.8.1/samples/bgbl-1_2023_413/aenderungsgesetz

# Make authenticated requests against the norms backend
[group('api')]
req params:
  http --session-read-only=ris-norms {{params}}

# Infra ---------------------------------------------------

# Tear down and re-create Docker images
[group('infra')]
rebuild-docker:
  docker compose down
  docker image rm $(docker image ls --filter "reference=ris-norms-app" --format json | jq -r .ID)
  docker compose up -d

# Start services
[group('infra')]
services:
  docker compose -f docker-compose-services.yaml up -d

# Stop services
[group('infra')]
services-stop:
  docker compose -f docker-compose-services.yaml down

# Remove the volume that contains the database data (services must be stopped first)
[group('infra')]
wipe-db: services-stop
  docker volume rm ris-norms_postgres14-data
  just services

# Util ----------------------------------------------------

# List all error URIs
[group('util'), working-directory('backend/src/main')]
list-error-uris:
  rg --only-matching --no-filename --no-line-number --no-heading -e '"\/errors\/.+"' | sort | uniq

# Refresh all GUIDs in the specified XML file
[group('util')]
bump-guids xmlpath:
  deno run -RW ~/Projects/ris-utils/bump-guids.ts {{xmlpath}}

[group('util'), working-directory('LegalDocML.de/1.8.1')]
validate-xml xmlpath='LegalDocML.de/1.8.1/schema-extension-fixtures/SaatG_regelungstext/regelungstext-verkuendung-1.xml':
  xmllint --noout --schema legalDocML.de-risnorms-regelungstextverkuendungsfassung.xsd "{{invocation_directory()}}/{{xmlpath}}"
