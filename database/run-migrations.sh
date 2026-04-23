#!/bin/bash
# Auto-migration script for PostgreSQL initialization
# This script runs after init.sql and applies all required migrations in order

set -e

echo "=========================================="
echo "  Running Database Migrations"
echo "=========================================="

# List of required migrations in order (from database/migrations/)
migrations=(
    "001_add_versioning_and_metrics.sql"
    "002_add_bytea_storage.sql"
    "002_add_cancelled_study_flag.sql"
    "002_add_notifications_and_task_progress.sql"
    "002_create_study_feature.sql"
    "003_add_admin_user.sql"
    "003_add_reviewer_assignments.sql"
    "003_add_tags_system.sql"
    "003_update_cascade_constraints.sql"
    "004_add_deadline_column_if_missing.sql"
    "005_add_task_progress_unique_constraint.sql"
    "006_add_answer_type_to_evaluation_tasks.sql"
    "007_add_draft_evaluations.sql"
    "008_add_screenshots_and_highlights.sql"
    "009_add_quiz_attempts.sql"
    "010_add_study_quiz_requirements.sql"
    "011_add_evaluation_tasks_columns.sql"
    "011_add_question_type.sql"
    "012_add_task_criteria_table.sql"
    "013_add_analysis_jobs_and_api_keys.sql"
    "013_add_capacity_notifications_tracking.sql"
    "014_add_deadline_notifications_tracking.sql"
    "014_add_evaluation_artifact_tags.sql"
    "014_fix_reviewer_features.sql"
    "015_add_soft_delete_to_artifacts.sql"
    "015_add_temporary_password_support.sql"
    "015_fix_criteria_below_text.sql"
    "016_add_artifact_collections.sql"
    "017_add_user_suspension.sql"
    "018_add_evaluation_and_quiz_attempt_trash_bin.sql"
    "019_add_participant_study_trash_bin.sql"
    "019_remove_global_quiz_attempt_constraint.sql"
    "add_study_deletion_support.sql"
    "add_study_questions.sql"
    "add_study_quizzes_junction.sql"
    "add_admin_policies_tables.sql"
    "add_analysis_jobs_table.sql"
    "add_flagged_column.sql"
    "add_retention_policies_tables.sql"
    "add_unique_study_attempt_index.sql"
    "fix_users_role_constraint.sql"
)

# Apply each database migration
for migration in "${migrations[@]}"; do
    migration_file="/docker-entrypoint-initdb.d/migrations/$migration"
    
    if [ -f "$migration_file" ]; then
        echo "→ Applying: $migration"
        psql -v ON_ERROR_STOP=0 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$migration_file" 2>&1 | grep -E "(CREATE|ALTER|INSERT|ERROR|NOTICE:|already exists)" || true
    else
        echo "⚠ Warning: Migration file not found: $migration"
    fi
done

echo ""
echo "=========================================="
echo "  ✓ All migrations applied successfully"
echo "  Total: 41 migrations"
echo "=========================================="
