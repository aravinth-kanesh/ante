"""add star stories table

Revision ID: c9e5a3f01d76
Revises: b8d4f2a61c95
Create Date: 2026-08-29 12:30:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'c9e5a3f01d76'
down_revision: str | None = 'b8d4f2a61c95'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'star_stories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False, server_default=''),
        sa.Column('situation', sa.Text(), nullable=False, server_default=''),
        sa.Column('task', sa.Text(), nullable=False, server_default=''),
        sa.Column('action', sa.Text(), nullable=False, server_default=''),
        sa.Column('result', sa.Text(), nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_star_stories_user_id'), 'star_stories', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_star_stories_user_id'), table_name='star_stories')
    op.drop_table('star_stories')
