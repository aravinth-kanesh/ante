import { render, screen, within } from "@testing-library/react";
import TrendChart, { VerdictBars, type TrendPoint } from "./TrendChart";

const points: TrendPoint[] = [
  { label: "1 Feb", value: 40 },
  { label: "8 Feb", value: 55 },
  { label: "15 Feb", value: 70 },
];

const pct = (v: number) => `${Math.round(v)}%`;

describe("TrendChart", () => {
  it("renders a data table with a row per point and formatted values", () => {
    render(<TrendChart points={points} format={pct} label="Strong-answer rate" goodLow={60} goodHigh={100} />);
    const table = screen.getByRole("table");
    // header row + three data rows
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(1 + points.length);
    expect(within(table).getByText("40%")).toBeInTheDocument();
    expect(within(table).getByText("70%")).toBeInTheDocument();
  });

  it("summarises the trend in the caption", () => {
    const { container } = render(
      <TrendChart points={points} format={pct} label="Strong-answer rate" goodLow={60} goodHigh={100} />,
    );
    const caption = container.querySelector("caption");
    expect(caption?.textContent).toContain("from 40% on 1 Feb to 70% on 15 Feb");
    expect(caption?.textContent).toContain("across 3 interviews");
  });

  it("hides the SVG from assistive tech", () => {
    const { container } = render(<TrendChart points={points} format={pct} label="Rate" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("returns nothing for an empty series", () => {
    const { container } = render(<TrendChart points={[]} format={pct} label="Rate" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("VerdictBars", () => {
  it("tabulates strong, adequate and weak counts per interview", () => {
    render(
      <VerdictBars
        rows={[
          { label: "1 Feb", verdicts: { strong: 2, adequate: 1, weak: 3 } },
          { label: "8 Feb", verdicts: { strong: 4, adequate: 0, weak: 1 } },
        ]}
      />,
    );
    const table = screen.getByRole("table");
    const firstRow = within(table).getByRole("row", { name: /1 Feb/ });
    expect(within(firstRow).getByText("2")).toBeInTheDocument();
    expect(within(firstRow).getByText("3")).toBeInTheDocument();
  });

  it("renders nothing when every interview has no rated answers", () => {
    const { container } = render(
      <VerdictBars rows={[{ label: "1 Feb", verdicts: { strong: 0, adequate: 0, weak: 0 } }]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
