"""add interview pacing columns

Revision ID: e3a7c1d94f28
Revises: c5669b522b3e
Create Date: 2026-08-10 09:20:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'e3a7c1d94f28'
down_revision: str | None = 'c5669b522b3e'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Server defaults let these NOT NULL columns be added to a table with existing rows;
    # new sessions get their values from the ORM model defaults.
    with op.batch_alter_table('interview_sessions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('duration_target_min', sa.Integer(), nullable=False, server_default=sa.text("10")))
        batch_op.add_column(sa.Column('wrapping_up', sa.Boolean(), nullable=False, server_default=sa.text("0")))


def downgrade() -> None:
    with op.batch_alter_table('interview_sessions', schema=None) as batch_op:
        batch_op.drop_column('wrapping_up')
        batch_op.drop_column('duration_target_min')
