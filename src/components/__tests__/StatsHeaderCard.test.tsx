// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { StatsHeaderCard } from "@/components/StatsHeaderCard";

describe("StatsHeaderCard", () => {
  it("renders totalLikes and totalDownloads when both are non-zero", () => {
    render(<StatsHeaderCard totalLikes={15} totalDownloads={8} />);

    expect(screen.getByText("15")).not.toBeNull();
    expect(screen.getByText("8")).not.toBeNull();
  });

  it("renders '0' for both values when zeros are passed, without error", () => {
    render(<StatsHeaderCard totalLikes={0} totalDownloads={0} />);

    const zeros = screen.getAllByText("0");
    // Both totalLikes and totalDownloads should display as "0"
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });

  it("renders exactly the numbers passed (no internal filtering)", () => {
    render(<StatsHeaderCard totalLikes={3} totalDownloads={5} />);

    expect(screen.getByText("3")).not.toBeNull();
    expect(screen.getByText("5")).not.toBeNull();
  });
});
