import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import HomePage from "../page";

it("renders site heading", () => {
  render(<HomePage />);
  expect(
    screen.getByRole("heading", { name: /allarounder/i }),
  ).toBeInTheDocument();
});
