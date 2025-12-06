package org.example.api;

import org.example.model.UserRole;
import org.example.repo.*;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final UserRepository users;
    private final AssignmentRepository assignments;
    private final ProblemRepository problems;
    private final SubmissionRepository submissions;
    private final FormulaRepository formulas;

    public StatsController(UserRepository users, AssignmentRepository assignments,
                           ProblemRepository problems, SubmissionRepository submissions,
                           FormulaRepository formulas) {
        this.users = users;
        this.assignments = assignments;
        this.problems = problems;
        this.submissions = submissions;
        this.formulas = formulas;
    }

    @GetMapping("/overview")
    public Map<String, Object> overview() {
        return Map.of(
                "usersTotal", users.count(),
                "teachers", users.countByRole(UserRole.TEACHER),
                "students", users.countByRole(UserRole.STUDENT),
                "assignments", assignments.count(),
                "problems", problems.count(),
                "submissions", submissions.count(),
                "formulas", formulas.count()
        );
    }

    @GetMapping("/user/{id}")
    public Map<String, Object> byUser(@PathVariable Long id) {
        return Map.of(
                "assignmentsByTeacher", assignments.countByTeacher_Id(id),
                "submissionsByStudent", submissions.countByStudent_Id(id),
                "formulasByStudent", formulas.countBySubmission_Student_Id(id)
        );
    }
}
