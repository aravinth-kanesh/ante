import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getPrepQuestions, type PrepGroup } from "../api";
import { Button, Card, CardBody } from "../components/ui";

// A curated set of common questions grouped by kind, each with a one-line pointer, so a
// student can browse and practise without generating anything first.
const CURATED: { category: string; note: string; questions: string[] }[] = [
  {
    category: "Opening",
    note: "Warm-ups that set the tone. Aim for a crisp, ninety-second answer.",
    questions: ["Tell me about yourself.", "Why do you want this role?", "Why do you want to work for this company?"],
  },
  {
    category: "Behavioural and motivation",
    note: "About you and your fit. Back claims with a real example, not generic reasons.",
    questions: [
      "What are your greatest strengths?",
      "What is a weakness you are working on?",
      "Why should we hire you?",
      "Where do you see yourself in five years?",
    ],
  },
  {
    category: "Competency (tell me about a time...)",
    note: "Use STAR, and centre the Action on what you personally did.",
    questions: [
      "Tell me about a time you worked well in a team.",
      "Tell me about a time you showed leadership.",
      "Describe a challenge you faced and how you handled it.",
      "Tell me about a time you dealt with a setback or failure.",
      "Describe a time you had to meet a tight deadline.",
      "Tell me about a disagreement and how you resolved it.",
    ],
  },
  {
    category: "Strengths-based",
    note: "Answer quickly and honestly; let genuine enthusiasm show.",
    questions: [
      "What kind of work do you most enjoy?",
      "What comes naturally to you?",
      "What are you most proud of?",
    ],
  },
];

function QuestionList({
  questions,
  onPractise,
}: {
  questions: string[];
  onPractise: (question: string) => void;
}) {
  return (
    <ul className="mt-3 divide-y divide-slate-100">
      {questions.map((q) => (
        <li key={q} className="flex items-center justify-between gap-3 py-2.5">
          <span className="text-sm text-slate-700">{q}</span>
          <Button variant="secondary" size="sm" onClick={() => onPractise(q)}>
            Practise
          </Button>
        </li>
      ))}
    </ul>
  );
}

export default function QuestionBank() {
  const navigate = useNavigate();
  const [mine, setMine] = useState<PrepGroup[]>([]);

  useEffect(() => {
    getPrepQuestions()
      .then(setMine)
      .catch(() => setMine([]));
  }, []);

  function practise(question: string) {
    navigate("/practice", { state: { question } });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Question bank</h1>
        <p className="mt-1 text-sm text-slate-500">
          Common interview questions to browse and rehearse. Practise any one for instant feedback,
          or generate questions tailored to your role in{" "}
          <Link to="/prepare" className="font-medium text-brand-700 hover:underline">
            Prepare
          </Link>
          .
        </p>
      </div>

      {mine.length > 0 && (
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold text-slate-900">Your likely questions</h2>
            <p className="mt-1 text-sm text-slate-500">
              Generated from your CV and the job description.
            </p>
            {mine.map((group) => (
              <div key={group.category} className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                  {group.category}
                </p>
                <QuestionList questions={group.questions.map((q) => q.question)} onPractise={practise} />
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {CURATED.map((group) => (
        <Card key={group.category}>
          <CardBody>
            <h2 className="text-base font-semibold text-slate-900">{group.category}</h2>
            <p className="mt-1 text-sm text-slate-500">{group.note}</p>
            <QuestionList questions={group.questions} onPractise={practise} />
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
