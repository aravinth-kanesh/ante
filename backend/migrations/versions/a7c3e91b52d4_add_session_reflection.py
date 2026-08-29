"""add interview reflection column

Revision ID: a7c3e91b52d4
Revises: f4b2a9c17d3e
Create Date: 2026-08-29 11:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'a7c3e91b52d4'
down_revision: str | None = 'f4b2a9c17d3e'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('interview_sessions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('reflection', sa.Text(), nullable=False, server_default=''))


def downgrade() -> None:
    with op.batch_alter_table('interview_sessions', schema=None) as batch_op:
        batch_op.drop_column('reflection')
