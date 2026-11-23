const express = require("express");
const auth = require("../middleware/auth");
const projectManagementService = require("../services/projectManagementService");

const router = express.Router();
router.use(auth);

router.get("/projects", async (req, res, next) => {
  try {
    res.json({ projects: await projectManagementService.listProjects(req.user) });
  } catch (error) {
    next(error);
  }
});

router.post("/projects", async (req, res, next) => {
  try {
    const project = await projectManagementService.createProject(req.body, req.user);
    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

router.patch("/projects/:projectId/status", async (req, res, next) => {
  try {
    const project = await projectManagementService.updateProjectStatus(
      req.params.projectId,
      req.body.status,
      req.user
    );
    res.json(project);
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:projectId", async (req, res, next) => {
  try {
    res.json(await projectManagementService.getProjectWorkspace(req.params.projectId, req.user));
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:projectId/member-candidates", async (req, res, next) => {
  try {
    const candidates = await projectManagementService.listMemberCandidates(
      req.params.projectId,
      req.query.search,
      req.user
    );
    res.json({ candidates });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:projectId/members", async (req, res, next) => {
  try {
    const member = await projectManagementService.addProjectMember(
      req.params.projectId,
      req.body,
      req.user
    );
    res.status(201).json(member);
  } catch (error) {
    next(error);
  }
});

router.delete("/projects/:projectId/members/:userId", async (req, res, next) => {
  try {
    res.json(await projectManagementService.removeProjectMember(
      req.params.projectId,
      req.params.userId,
      req.user
    ));
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:projectId/tasks", async (req, res, next) => {
  try {
    const task = await projectManagementService.createTask(req.params.projectId, req.body, req.user);
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

router.patch("/projects/:projectId/tasks/:taskId", async (req, res, next) => {
  try {
    res.json(await projectManagementService.updateTask(
      req.params.projectId,
      req.params.taskId,
      req.body,
      req.user
    ));
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:projectId/announcements", async (req, res, next) => {
  try {
    const announcement = await projectManagementService.createAnnouncement(
      req.params.projectId,
      req.body,
      req.user
    );
    res.status(201).json(announcement);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
