# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-05-01

### Added

- Blind evaluation engine with double-blind study support
- AI Artifact Generation (code, UML/PlantUML, clones, documentation)
- AI Quiz Generation for participant competency gating
- AI Artifact Analysis (cyclomatic complexity, maintainability score)
- Four-role RBAC: Admin, Researcher, Reviewer, Participant
- Study lifecycle state machine: Draft → Active → Completed → Archived
- Soft-deletion with Trash Bin recovery for studies, quizzes, evaluations
- Docker Compose full-stack setup (React + Express + PostgreSQL)
- MIT License
