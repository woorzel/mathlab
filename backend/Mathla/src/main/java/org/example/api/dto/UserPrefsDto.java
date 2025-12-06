// src/main/java/org/example/api/dto/UserPrefsDto.java
package org.example.api.dto;

public record UserPrefsDto(
        Boolean emailOnSubmit, // powiadomienia o wysyłce
        Boolean dailyDigest,   // podsumowanie dnia
        String  defaultFormat, // ASCIIMATH | TEX
        String  theme          // auto | light | dark
) {
    public static UserPrefsDto defaults() {
        return new UserPrefsDto(false, false, "ASCIIMATH", "auto");
    }
}
