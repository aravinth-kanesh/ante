"""add profile coach summary column

Revision ID: f1a6d2e4c8b0
Revises: e2f4c60b17a9
Create Date: 2026-09-01 12:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'f1a6d2e4c8b0'
down_revision: str | None = 'e2f4c60b17a9'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('profiles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('coach_summary', sa.Text(), nullable=False, server_default=''))


def downgrade() -> None:
    with op.batch_alter_table('profiles', schema=None) as batch_op:
        batch_op.drop_column('coach_summary')
