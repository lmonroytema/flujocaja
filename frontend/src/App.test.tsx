import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "@/App";

describe("App", () => {
  it("renderiza la portada de autenticación", () => {
    render(<App />);

    expect(screen.getByAltText("EMTA")).toBeInTheDocument();
    expect(screen.getByText("Acceso seguro")).toBeInTheDocument();
    expect(screen.getByText("Acceso inicial disponible")).toBeInTheDocument();
  });
});
