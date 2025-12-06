// src/main/java/org/example/api/dto/CreateFormulaRequest.java
package org.example.api.dto;

public record CreateFormulaRequest(
        Long problemId,
        Long submissionId,
        String rawInput,   // np. AsciiMath lub TeX (surowy tekst)
        String inputType,  // ASCIIMATH | TEX (string, mapowany w kontrolerze na enum)
        String mathml,     // MathML wygenerowany w przeglądarce
        String speechText  // opcjonalny, np. do TTS
) {}
