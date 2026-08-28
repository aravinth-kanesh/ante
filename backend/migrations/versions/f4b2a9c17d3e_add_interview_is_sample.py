"""add interview is_sample column

Revision ID: f4b2a9c17d3e
Revises: e3a7c1d94f28
Create Date: 2026-08-28 10:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'f4b2a9c17d3e'
down_revision: str | None = 'e3a7c1d94f28'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # A server default lets this NOT NULL column be added to a table with existing rows;
    # new sessions get their value from the ORM model default.
    with op.batch_alter_table('interview_sessions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_sample', sa.Boolean(), nullable=False, server_default=sa.text("false")))


def downgrade() -> None:
    with op.batch_alter_table('interview_sessions', schema=None) as batch_op:
        batch_op.drop_column('is_sample')
