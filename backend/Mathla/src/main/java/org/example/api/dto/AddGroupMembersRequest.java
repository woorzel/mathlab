package org.example.api.dto;

import java.util.List;

public record AddGroupMembersRequest(
        List<Long> studentIds,           // legacy: musi iść para z emails
        List<String> emails,             // legacy: para z studentIds
        List<MemberRef> members          // nowocześniej: lista par {id,email}
) {
    public record MemberRef(Long id, String email) {}
}
