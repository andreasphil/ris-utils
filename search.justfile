alias b := backend
alias f := frontend
alias ft := frontend-test
alias fts := frontend-test-standalone

default:
  just --list

# Run frontend
[group('frontend'), working-directory('frontend')]
frontend:
  yarn dev

# Run unit tests in watch mode
[group('frontend'), working-directory('frontend')]
frontend-test params='':
  yarn test:watch {{params}}

# Run unit tests in standalone mode
[group('frontend'), working-directory('frontend')]
frontend-test-standalone:
  yarn test:watch --standalone

# Run E2E test UI
[group('frontend'), working-directory('frontend')]
e2e:
  yarn exec playwright test --ui

[group('frontend'), working-directory('frontend')]
typecheck:
  yarn typecheck

# Run backend without automatic rebuilding, including E2E test seeds
[group('backend'), working-directory('backend')]
backend params='':
  ./gradlew clean bootRun --args='--spring.profiles.active=default,e2e' {{params}}

# Boot services
[group('infra')]
services:
  docker compose up -d

# Shut down services
[group('infra')]
services-stop:
  docker compose down
