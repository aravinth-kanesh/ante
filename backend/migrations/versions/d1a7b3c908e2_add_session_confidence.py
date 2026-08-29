"""add interview confidence columns

Revision ID: d1a7b3c908e2
Revises: c9e5a3f01d76
Create Date: 2026-08-29 13:30:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'd1a7b3c908e2'
down_revision: str | None = 'c9e5a3f01d76'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('interview_sessions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('confidence_before', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('confidence_after', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    with op.batch_alter_table('interview_sessions', schema=None) as batch_op:
        batch_op.drop_column('confidence_after')
        batch_op.drop_column('confidence_before')
