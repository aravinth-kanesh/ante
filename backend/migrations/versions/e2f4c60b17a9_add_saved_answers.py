"""add saved answers table

Revision ID: e2f4c60b17a9
Revises: d1a7b3c908e2
Create Date: 2026-08-29 14:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'e2f4c60b17a9'
down_revision: str | None = 'd1a7b3c908e2'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'saved_answers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('question', sa.String(), nullable=False, server_default=''),
        sa.Column('answer', sa.Text(), nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_saved_answers_user_id'), 'saved_answers', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_saved_answers_user_id'), table_name='saved_answers')
    op.drop_table('saved_answers')
