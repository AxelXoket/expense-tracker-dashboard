// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatKurus, kurusToInput, MAX_AMOUNT_KURUS, parseAmount, plainKurus } from "./money.js";

// Intl puts a narrow no-break space in some places; compare what a person reads.
const read = (text) => text.replace(/\s/g, " ");

describe("parseAmount reads what a Turkish user types", () => {
  it.each([
    ["1.234,50", 123450],
    ["1.234", 123400],
    ["1.234.567", 123456700],
    ["1234,5", 123450],
    ["1234", 123400],
    ["0,01", 1],
    ["12.5", 1250],
    ["12.50", 1250],
    [" 1 234,50 TL ", 123450],
    ["1 234 567", 123456700],
    ["1  234,50", 123450],
    ["12 345", 1234500],
    [`1${String.fromCharCode(160)}234,50`, 123450],
    ["50 tl", 5000],
    ["₺99,99", 9999],
    ["₺ 99,99", 9999],
    ["99,99 ₺", 9999],
    ["012", 1200],
    ["10.000.000", MAX_AMOUNT_KURUS],
  ])("%s -> %i kuruş", (typed, kurus) => {
    expect(parseAmount(typed)).toEqual({ kurus });
  });

  it.each([
    ["", "Tutarı yazın."],
    ["   ", "Tutarı yazın."],
    [undefined, "Tutarı yazın."],
    ["0", "Tutar sıfırdan büyük olmalı."],
    ["0,00", "Tutar sıfırdan büyük olmalı."],
    ["10.000.000,01", "Tutar en çok ₺10.000.000,00 olabilir."],
    ["-5", "Tutarı 1.250,50 biçiminde yazın."],
    ["1,234", "Tutarı 1.250,50 biçiminde yazın."],
    ["12.3456", "Tutarı 1.250,50 biçiminde yazın."],
    ["1.23.4", "Tutarı 1.250,50 biçiminde yazın."],
    ["abc", "Tutarı 1.250,50 biçiminde yazın."],
    ["1e3", "Tutarı 1.250,50 biçiminde yazın."],
    [",5", "Tutarı 1.250,50 biçiminde yazın."],
    ["1234.567", "Tutarı 1.250,50 biçiminde yazın."],
    ["1.234.5678", "Tutarı 1.250,50 biçiminde yazın."],
    ["0.500", "Tutarı 1.250,50 biçiminde yazın."],
    ["012.345", "Tutarı 1.250,50 biçiminde yazın."],
    ["12 50", "Tutarı 1.250,50 biçiminde yazın."],
    ["1TL5", "Tutarı 1.250,50 biçiminde yazın."],
    ["1 23", "Tutarı 1.250,50 biçiminde yazın."],
    ["1234 567", "Tutarı 1.250,50 biçiminde yazın."],
    ["1 234 56", "Tutarı 1.250,50 biçiminde yazın."],
    ["TL", "Tutarı yazın."],
  ])("%j is refused with %s", (typed, error) => {
    expect(read(parseAmount(typed).error ?? "")).toBe(read(error));
  });
});

describe("amounts are shown in Turkish format", () => {
  it("formats kuruş as Turkish lira", () => {
    expect(read(formatKurus(123450))).toBe("₺1.234,50");
    expect(read(formatKurus(5))).toBe("₺0,05");
    expect(read(formatKurus(0))).toBe("₺0,00");
  });

  it("writes plain numbers for spreadsheets", () => {
    expect(plainKurus(123450)).toBe("1234,50");
    expect(plainKurus(7)).toBe("0,07");
    expect(plainKurus(-150)).toBe("-1,50");
    expect(plainKurus(0)).toBe("0,00");
  });

  it("fills the amount field back so it parses to the same value", () => {
    for (const kurus of [1, 99, 123450, MAX_AMOUNT_KURUS]) {
      expect(parseAmount(kurusToInput(kurus))).toEqual({ kurus });
    }
    expect(kurusToInput(123450)).toBe("1.234,50");
  });
});
