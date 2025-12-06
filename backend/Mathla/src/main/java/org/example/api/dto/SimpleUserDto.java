// src/main/java/org/example/api/dto/SimpleUserDto.java
package org.example.api.dto;

public record SimpleUserDto(
        Long id,
        String name,
        String email
) {}
