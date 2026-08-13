from app.schemas.interview import FeedbackReport
from app.schemas.prepare import PrepResponse
from app.schemas.preparation import PreparationReport
from app.schemas.profile import CompanyResearch
from app.services import fake_llm
from app.services.moderation import Verdict


def test_moderation_reply_is_allowed():
    out = fake_llm.reply([{"role": "system", "content": '... {"allowed": true|false, ...}'}, {"role": "user", "content": "hi"}])
    assert Verdict(**__import__("json").loads(out)).allowed is True


def test_feedback_reply_is_valid_and_has_three_improvements():
    out = fake_llm.reply([{"role": "user", "content": "Give feedback.\nTranscript:\nInterviewer: Q\nCandidate: A"}])
    report = FeedbackReport.model_validate_json(out)
    assert report.summary and len(report.improvements) >= 3


def test_research_reply_is_valid():
    out = fake_llm.reply([{"role": "user", "content": "You are briefing a candidate who is about to interview for the role."}])
    assert CompanyResearch.model_validate_json(out).overview


def test_preparation_reply_is_valid():
    out = fake_llm.reply([{"role": "user", "content": "produce an honest competency gap analysis"}])
    report = PreparationReport.model_validate_json(out)
    assert report.competencies and report.plan


def test_questions_reply_has_four_groups():
    out = fake_llm.reply([{"role": "user", "content": "the interview questions ... grouped by category"}])
    assert len(PrepResponse.model_validate_json(out).groups) == 4


def test_interviewer_reply_rotates_with_the_conversation():
    system = {"role": "system", "content": "You are conducting a realistic mock interview"}
    first = fake_llm.reply([system, {"role": "user", "content": "Please begin."}])
    later = fake_llm.reply(
        [
            system,
            {"role": "assistant", "content": "Q1"},
            {"role": "user", "content": "A1"},
            {"role": "assistant", "content": "Q2"},
            {"role": "user", "content": "A2"},
        ]
    )
    assert first and later and first != later


def test_coach_summary_reply_is_prose():
    out = fake_llm.reply([{"role": "user", "content": "You are a supportive interview coach. Progress:"}])
    assert "{" not in out and len(out) > 20
