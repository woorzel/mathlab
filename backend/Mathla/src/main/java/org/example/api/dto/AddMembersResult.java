
package org.example.api.dto;

import java.util.List;
public record AddMembersResult(java.util.List<Long> added,
                               java.util.List<Long> duplicates,
                               java.util.List<Long> missing) {}