"""baseline schema

Revision ID: 948c88d0adf3
Revises: 
Create Date: 2026-08-02 14:25:06.447858
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '948c88d0adf3'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('email', sa.String(), nullable=False),
    sa.Column('hashed_password', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_users_email'), ['email'], unique=True)

    op.create_table('cvs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('label', sa.String(), nullable=False),
    sa.Column('filename', sa.String(), nullable=False),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('cvs', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_cvs_user_id'), ['user_id'], unique=False)

    op.create_table('interview_sessions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(), nullable=False),
    sa.Column('mode', sa.String(), nullable=False),
    sa.Column('interview_type', sa.String(), nullable=False),
    sa.Column('company', sa.String(), nullable=False),
    sa.Column('role', sa.String(), nullable=False),
    sa.Column('cv_snapshot', sa.Text(), nullable=False),
    sa.Column('jd_snapshot', sa.Text(), nullable=False),
    sa.Column('company_context_snapshot', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('interview_sessions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_interview_sessions_user_id'), ['user_id'], unique=False)

    op.create_table('profiles',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('cv_text', sa.Text(), nullable=False),
    sa.Column('cv_filename', sa.String(), nullable=False),
    sa.Column('selected_cv_id', sa.Integer(), nullable=True),
    sa.Column('jd_text', sa.Text(), nullable=False),
    sa.Column('company', sa.String(), nullable=False),
    sa.Column('role', sa.String(), nullable=False),
    sa.Column('company_context', sa.Text(), nullable=False),
    sa.Column('company_research', sa.Text(), nullable=False),
    sa.Column('prep_questions', sa.Text(), nullable=False),
    sa.Column('preparation', sa.Text(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )
    op.create_table('turns',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('session_id', sa.Integer(), nullable=False),
    sa.Column('index', sa.Integer(), nullable=False),
    sa.Column('role', sa.String(), nullable=False),
    sa.Column('kind', sa.String(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('metrics', sa.Text(), nullable=True),
    sa.Column('nonverbal', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['session_id'], ['interview_sessions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('turns', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_turns_session_id'), ['session_id'], unique=False)



def downgrade() -> None:
    with op.batch_alter_table('turns', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_turns_session_id'))

    op.drop_table('turns')
    op.drop_table('profiles')
    with op.batch_alter_table('interview_sessions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_interview_sessions_user_id'))

    op.drop_table('interview_sessions')
    with op.batch_alter_table('cvs', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_cvs_user_id'))

    op.drop_table('cvs')
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_users_email'))

    op.drop_table('users')
