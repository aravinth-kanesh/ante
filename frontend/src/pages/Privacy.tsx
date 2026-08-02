import { Link } from "react-router-dom";
import Logo from "../components/Logo";

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-base font-semibold text-slate-900">{heading}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <Logo size={36} />
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Privacy</h1>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-6 text-sm text-slate-600">
            Ante is an interview practice tool. This page explains what it stores about you and the
            choices you have. It is written for a student research setting.
          </p>

          <Section heading="What we store">
            <p>
              Your account email and a hashed password. The material you add for practice: your CV
              text, the job description you paste, and the company research, questions and
              preparation notes generated from them. Your mock interview transcripts and the
              feedback on them.
            </p>
          </Section>

          <Section heading="Voice and webcam">
            <p>
              During a spoken interview your microphone audio is transcribed to measure pace, pauses
              and filler words. The audio is processed in memory and is not saved.
            </p>
            <p>
              If you turn the camera on, the analysis of your webcam runs entirely in your browser.
              No video or image is uploaded. Only derived numbers, such as an estimate of how often
              you faced the camera and how steady you were, are sent and stored with that answer.
            </p>
          </Section>

          <Section heading="How the AI is used">
            <p>
              Your CV, the job description and your answers are sent to a language model to generate
              questions and feedback. Do not paste anything you would not want processed this way.
            </p>
          </Section>

          <Section heading="Your choices">
            <p>
              You can download everything held about your account as a file, and you can permanently
              delete your account and all of its data, both from Settings.
            </p>
          </Section>

          <div className="mt-8 border-t border-slate-200 pt-5 text-sm">
            <Link to="/signup" className="font-medium text-brand-700 hover:underline">
              Back to sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
