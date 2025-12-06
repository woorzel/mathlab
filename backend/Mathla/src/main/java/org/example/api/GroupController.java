// src/main/java/org/example/api/GroupController.java
package org.example.api;

import org.example.api.dto.*;
import org.example.model.Group;
import org.example.model.GroupStudent;
import org.example.model.User;
import org.example.model.UserRole;
import org.example.repo.GroupRepository;
import org.example.repo.GroupStudentRepository;
import org.example.repo.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.*;

@RestController
@RequestMapping("/api/groups")
public class GroupController {

    private final GroupRepository groups;
    private final GroupStudentRepository groupStudents;
    private final UserRepository users;

    public GroupController(GroupRepository groups, GroupStudentRepository groupStudents, UserRepository users) {
        this.groups = groups;
        this.groupStudents = groupStudents;
        this.users = users;
    }

    // GET /api/groups?teacherId=...  |  /api/groups?studentId=...
    // (oba parametry są OPCJONALNE; jeżeli brak obu – zwróci wszystkie)
    @GetMapping
    public List<GroupDto> list(@RequestParam(required = false) Long teacherId,
                               @RequestParam(required = false) Long studentId) {
        if (teacherId != null) {
            return groups.findByTeacher_Id(teacherId).stream()
                    .map(g -> toDto(g, null))
                    .toList();
        }
        if (studentId != null) {
            var links = groupStudents.findByStudent_Id(studentId);
            return links.stream()
                    .map(GroupStudent::getGroup)
                    .distinct()
                    .map(g -> toDto(g, null))
                    .toList();
        }
        // fallback – np. dla admina/dev
        return groups.findAll().stream().map(g -> toDto(g, null)).toList();
    }

    private GroupDto toDto(Group g, Integer sizeOverride) {
        String teacherName = null;
        String teacherEmail = null;
        if (g.getTeacher() != null) {
            teacherEmail = g.getTeacher().getEmail();
            var nm = g.getTeacher().getName();
            teacherName = (nm != null && !nm.isBlank()) ? nm : teacherEmail;
        }
        Integer size = (sizeOverride != null) ? sizeOverride : groupStudents.countByGroup_Id(g.getId());
        return new GroupDto(g.getId(), g.getName(), teacherName, teacherEmail, size);
    }

    // POST /api/groups  { name, teacherId }
    @PostMapping
    public ResponseEntity<GroupDto> create(@RequestBody CreateGroupRequest req) {
        if (req.name() == null || req.name().isBlank() || req.teacherId() == null) {
            return ResponseEntity.badRequest().build();
        }
        User teacher = users.findById(req.teacherId()).orElseThrow();
        if (teacher.getRole() != UserRole.TEACHER) {
            return ResponseEntity.status(403).build();
        }
        Group g = new Group();
        g.setName(req.name().trim());
        g.setTeacher(teacher);
        groups.save(g);
        return ResponseEntity.created(URI.create("/api/groups/" + g.getId()))
                .body(toDto(g, 0));
    }

    // GET /api/groups/{gid}/students -> lista uczniów (id, name, email)
    @GetMapping("/{gid}/students")
    public List<SimpleUserDto> members(@PathVariable Long gid) {
        return groupStudents.findByGroup_Id(gid).stream()
                .map(gs -> gs.getStudent())
                .map(u -> new SimpleUserDto(u.getId(), u.getName(), u.getEmail()))
                .toList();
    }

    // POST /api/groups/{gid}/students
    @PostMapping("/{gid}/students")
    public AddMembersResult addMembers(@PathVariable Long gid,
                                       @RequestBody AddGroupMembersRequest body) {
        Group g = groups.findById(gid).orElseThrow();

        List<Long> added = new ArrayList<>();
        List<Long> duplicates = new ArrayList<>();
        List<Long> missingOrMismatch = new ArrayList<>();

        var refs = body.members();
        if (refs != null && !refs.isEmpty()) {
            for (var m : refs) {
                processOneMember(gid, g, m.id(), m.email(), added, duplicates, missingOrMismatch);
            }
            return new AddMembersResult(added, duplicates, missingOrMismatch);
        }

        var ids = body.studentIds() == null ? List.<Long>of() : body.studentIds();
        var emails = body.emails() == null ? List.<String>of() : body.emails();

        if (ids.isEmpty() && emails.isEmpty()) {
            return new AddMembersResult(added, duplicates, missingOrMismatch);
        }
        if (ids.size() != emails.size()) {
            for (Long id : ids) missingOrMismatch.add(id);
            return new AddMembersResult(added, duplicates, missingOrMismatch);
        }
        for (int i = 0; i < ids.size(); i++) {
            processOneMember(gid, g, ids.get(i), emails.get(i), added, duplicates, missingOrMismatch);
        }
        return new AddMembersResult(added, duplicates, missingOrMismatch);
    }

    private void processOneMember(Long gid,
                                  Group g,
                                  Long id,
                                  String email,
                                  List<Long> added,
                                  List<Long> duplicates,
                                  List<Long> missingOrMismatch) {
        if (id == null || email == null || email.isBlank()) {
            if (id != null) missingOrMismatch.add(id);
            return;
        }

        var uOpt = users.findById(id);
        if (uOpt.isEmpty()) { missingOrMismatch.add(id); return; }

        var u = uOpt.get();
        if (u.getRole() != UserRole.STUDENT ||
                u.getEmail() == null ||
                !u.getEmail().trim().equalsIgnoreCase(email.trim())) {
            missingOrMismatch.add(id);
            return;
        }

        if (groupStudents.existsByGroup_IdAndStudent_Id(gid, id)) {
            duplicates.add(id);
            return;
        }

        GroupStudent gs = new GroupStudent();
        gs.setGroup(g);
        gs.setStudent(u);
        groupStudents.save(gs);
        added.add(id);
    }

    // DELETE /api/groups/{gid}/students/{sid}
    @DeleteMapping("/{gid}/students/{sid}")
    public ResponseEntity<Void> remove(@PathVariable Long gid, @PathVariable Long sid) {
        long n = groupStudents.deleteByGroup_IdAndStudent_Id(gid, sid);
        return n > 0 ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    // DELETE /api/groups/{gid}
    @DeleteMapping("/{gid}")
    @Transactional
    public ResponseEntity<Void> deleteGroup(@PathVariable Long gid) {
        if (!groups.existsById(gid)) return ResponseEntity.notFound().build();
        groupStudents.deleteByGroup_Id(gid);
        groups.deleteById(gid);
        return ResponseEntity.noContent().build();
    }

    // (opcjonalnie – zgodność wsteczna; możesz zostawić lub usunąć,
    // skoro jest już query param studentId)
    @GetMapping("/of-student/{sid}")
    public List<Map<String, Object>> groupsOfStudent(@PathVariable Long sid) {
        var links = groupStudents.findByStudent_Id(sid);
        var groupIds = links.stream().map(gs -> gs.getGroup().getId()).toList();
        var list = groups.findAllById(groupIds);

        List<Map<String, Object>> out = new ArrayList<>();
        for (var g : list) {
            var t = g.getTeacher();
            var members = groupStudents.findByGroup_Id(g.getId()).stream().map(gs -> {
                var u = gs.getStudent();
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", u.getId());
                m.put("name", u.getName());
                m.put("email", u.getEmail());
                return m;
            }).toList();

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", g.getId());
            item.put("name", g.getName());
            Map<String, Object> teacher = new LinkedHashMap<>();
            if (t != null) {
                teacher.put("id", t.getId());
                teacher.put("name", t.getName());
                teacher.put("email", t.getEmail());
            }
            item.put("teacher", teacher);
            item.put("members", members);

            out.add(item);
        }
        return out;
    }
}
