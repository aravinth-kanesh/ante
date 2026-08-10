"""add refresh sessions

Revision ID: de86bc951212
Revises: 948c88d0adf3
Create Date: 2026-08-02 14:37:45.743207
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'de86bc951212'
down_revision: str | None = '948c88d0adf3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('refresh_sessions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('token_hash', sa.String(), nullable=False),
    sa.Column('issued_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('user_agent', sa.String(), nullable=False),
    sa.Column('ip', sa.String(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('refresh_sessions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_refresh_sessions_token_hash'), ['token_hash'], unique=True)
        batch_op.create_index(batch_op.f('ix_refresh_sessions_user_id'), ['user_id'], unique=False)



def downgrade() -> None:
    with op.batch_alter_table('refresh_sessions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_refresh_sessions_user_id'))
        batch_op.drop_index(batch_op.f('ix_refresh_sessions_token_hash'))

    op.drop_table('refresh_sessions')
