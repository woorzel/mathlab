// src/main/java/org/example/api/dto/GroupDto.java
package org.example.api.dto;

public record GroupDto(
        Long id,
        String name,
        String teacherName,
        String teacherEmail,
        Integer size
) {}
