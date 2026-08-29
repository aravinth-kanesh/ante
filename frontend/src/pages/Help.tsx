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

function Metric({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <p>
      <span className="font-medium text-slate-800">{name}.</span> {children}
    </p>
  );
}

export default function Help() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <Logo size={36} />
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Help</h1>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-6 text-sm text-slate-600">
            Ante helps you practise for job interviews. You add your CV and the job you are going
            for, then run realistic mock interviews and get honest, specific feedback on your
            answers and how you came across. Nerves are normal, and the whole point is to practise
            somewhere it does not count.
          </p>

          <Section heading="Getting started">
            <p>
              In a hurry or just curious? On the interview page, choose{" "}
              <span className="font-medium text-slate-800">Try a sample interview</span> to run the
              whole thing on an example CV and role, with no setup.
            </p>
            <p>To practise for a real role, the usual path is three steps:</p>
            <p>
              1. Add your CV under <span className="font-medium text-slate-800">CVs</span> (paste it
              or upload a PDF or Word file). You can keep more than one and switch the active one.
            </p>
            <p>
              2. In <span className="font-medium text-slate-800">Prepare</span>, paste the job
              description. Ante researches the company and role, shows where your CV is strong or
              thin, and generates likely questions.
            </p>
            <p>
              3. Start a <span className="font-medium text-slate-800">Mock interview</span>. Answer
              by typing, or turn on voice to answer out loud (and optionally the camera). At the end
              you get feedback, and your trends build up under Progress.
            </p>
          </Section>

          <Section heading="Getting the most from it">
            <p>
              Treat it like the real thing: answer out loud where you can, and give full answers
              with a specific example rather than a sentence or two.
            </p>
            <p>
              For behavioural and competency questions, use STAR: set the Situation, the Task you
              faced, the Action you personally took, and the Result. There is a STAR reminder on the
              answer box.
            </p>
            <p>
              Read the model answers on any weak answer to hear how a strong one sounds, then redo a
              focused mock aimed at your weak spots. A few short sessions beat one long one.
            </p>
          </Section>

          <Section heading="What the feedback measures">
            <p>Feedback covers the content of your answers and, in voice mode, how you delivered them.</p>
            <Metric name="Answer quality">
              Each answer is rated strong, adequate or weak on its merits, with a note on why and
              how to make it stronger. This is measured for every interview, including typed ones.
            </Metric>
            <Metric name="Speaking pace">
              How fast you speak, in words per minute. A comfortable pace is roughly 110 to 160.
            </Metric>
            <Metric name="Filler words">
              How often fillers like &ldquo;um&rdquo; and &ldquo;you know&rdquo; crept in. Fewer
              reads as more confident; aim for under about three a minute.
            </Metric>
            <Metric name="Eye contact">
              Only when the camera is on, and worked out entirely in your browser: an estimate of how
              often you faced the camera. It is a rough proxy for eye contact, not a judgement of you.
            </Metric>
            <Metric name="Composure">
              Again camera only: how steady and settled your position was, as a rough proxy for
              looking composed.
            </Metric>
          </Section>

          <Section heading="Your privacy">
            <p>
              Your microphone audio is transcribed in memory and not saved unless you choose to save
              a recording, and any webcam analysis runs in your browser. The{" "}
              <Link to="/privacy" className="font-medium text-brand-700 hover:underline">
                privacy page
              </Link>{" "}
              has the full detail, and you can export or delete all your data from Settings.
            </p>
          </Section>

          <div className="mt-8 border-t border-slate-200 pt-5 text-sm">
            <Link to="/" className="font-medium text-brand-700 hover:underline">
              Back to Ante
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
