# Contributing to RitHub

Thank you for your interest in contributing! Here's how to get started.

## Getting Started

1. **Clone** the repository:
   ```bash
   git clone https://github.com/ansarmyrzagerey/RitHub.git
   cd RitHub
   ```
2. Copy `.env.example` to `.env` and fill in your values (see [README.md](./README.md)).
3. **Run** the full stack in one command:
   ```bash
   docker-compose up
   ```

## Branch Naming Convention

| Prefix      | Purpose                        |
| ----------- | ------------------------------ |
| `feature/`  | New features                   |
| `fix/`      | Bug fixes                      |
| `docs/`     | Documentation-only changes     |

Example: `feature/add-export-csv`, `fix/quiz-score-rounding`, `docs/update-readme`.

## Commit Message Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short description>

[optional body]
```

Common types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `ci`.

## Pull Request Process

1. Create a branch from `main` using the naming convention above.
2. Make your changes, commit with conventional messages.
3. Open a PR against `main`.
4. In the PR description, explain **what** changed and **why**.
5. Ensure the Docker build passes (`docker-compose build`).
6. A maintainer will review and merge your PR.

## Code of Conduct

Be respectful and constructive. We're all here to build something great.
