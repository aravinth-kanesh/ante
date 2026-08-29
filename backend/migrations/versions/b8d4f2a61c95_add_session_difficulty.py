"""add interview difficulty column

Revision ID: b8d4f2a61c95
Revises: a7c3e91b52d4
Create Date: 2026-08-29 11:30:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'b8d4f2a61c95'
down_revision: str | None = 'a7c3e91b52d4'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('interview_sessions', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('difficulty', sa.String(), nullable=False, server_default='standard')
        )


def downgrade() -> None:
    with op.batch_alter_table('interview_sessions', schema=None) as batch_op:
        batch_op.drop_column('difficulty')
