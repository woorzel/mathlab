// src/main/java/org/example/api/dto/AssignStudentsRequest.java
package org.example.api.dto;

import java.util.List;

public record AssignStudentsRequest(
        List<Long> studentIds,
        String dueAt // ISO-8601 lub null, np. 2025-10-24T01:24:00Z
) {}
