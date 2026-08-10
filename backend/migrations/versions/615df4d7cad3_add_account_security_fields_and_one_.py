"""add account security fields and one-time tokens

Revision ID: 615df4d7cad3
Revises: de86bc951212
Create Date: 2026-08-02 19:22:01.268698
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '615df4d7cad3'
down_revision: str | None = 'de86bc951212'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('one_time_tokens',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('purpose', sa.String(), nullable=False),
    sa.Column('token_hash', sa.String(), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('one_time_tokens', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_one_time_tokens_purpose'), ['purpose'], unique=False)
        batch_op.create_index(batch_op.f('ix_one_time_tokens_token_hash'), ['token_hash'], unique=True)
        batch_op.create_index(batch_op.f('ix_one_time_tokens_user_id'), ['user_id'], unique=False)

    # Server defaults let these NOT NULL columns be added to a table that already
    # has rows; new accounts get their values from the ORM model defaults.
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text("1")))
        batch_op.add_column(sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.text("0")))
        batch_op.add_column(sa.Column('failed_login_count', sa.Integer(), nullable=False, server_default=sa.text("0")))
        batch_op.add_column(sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('password_changed_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('consented_at', sa.DateTime(timezone=True), nullable=True))



def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('consented_at')
        batch_op.drop_column('password_changed_at')
        batch_op.drop_column('locked_until')
        batch_op.drop_column('failed_login_count')
        batch_op.drop_column('is_verified')
        batch_op.drop_column('is_active')

    with op.batch_alter_table('one_time_tokens', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_one_time_tokens_user_id'))
        batch_op.drop_index(batch_op.f('ix_one_time_tokens_token_hash'))
        batch_op.drop_index(batch_op.f('ix_one_time_tokens_purpose'))

    op.drop_table('one_time_tokens')
