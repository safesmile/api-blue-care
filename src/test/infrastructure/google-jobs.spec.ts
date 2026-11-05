import { ConfigService } from "@nestjs/config";
import type { ExecutionContext } from "@nestjs/common";
import { GoogleJobQueue } from "../../infrastructure/jobs/google-job-queue";
import { GoogleJobScheduler } from "../../infrastructure/jobs/google-job-scheduler";
import { GoogleJobGuard } from "../../infrastructure/jobs/google-job.guard";
const createTask = jest.fn(),
  deleteTask = jest.fn(),
  updateJob = jest.fn(),
  createJob = jest.fn(),
  deleteJob = jest.fn(),
  verifyIdToken = jest.fn();
jest.mock("@google-cloud/tasks", () => ({
  CloudTasksClient: jest.fn().mockImplementation(() => ({
    queuePath: (p, l, q) => `projects/${p}/locations/${l}/queues/${q}`,
    createTask: (...a) => createTask(...a),
    deleteTask: (...a) => deleteTask(...a)
  }))
}));
jest.mock("@google-cloud/scheduler", () => ({
  CloudSchedulerClient: jest.fn().mockImplementation(() => ({
    jobPath: (p, l, id) => `projects/${p}/locations/${l}/jobs/${id}`,
    updateJob: (...a) => updateJob(...a),
    createJob: (...a) => createJob(...a),
    deleteJob: (...a) => deleteJob(...a)
  }))
}));
jest.mock("google-auth-library", () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken: (...a) => verifyIdToken(...a) }))
}));
const values = {
  GCP_JOBS_ENABLED: "true",
  GOOGLE_CLOUD_PROJECT: "blue-test",
  GCP_LOCATION: "us-central1",
  GCP_TASKS_QUEUE: "notifications",
  GCP_CALLBACK_URL: "https://blue.example",
  GCP_JOBS_AUDIENCE: "https://blue.example",
  GCP_JOBS_SERVICE_ACCOUNT: "jobs@blue-test.iam.gserviceaccount.com"
};
describe("Google job adapters", () => {
  const config = new ConfigService(values);
  beforeEach(() => {
    jest.clearAllMocks();
    [createTask, deleteTask, updateJob, createJob, deleteJob, verifyIdToken].forEach(mock => mock.mockReset());
  });
  it("does not enqueue while disabled", async () => {
    const queue = new GoogleJobQueue(new ConfigService({}));
    expect(await queue.enqueue({ id: "id", path: "/", payload: {} })).toBeNull();
    await queue.cancel("id");
    expect(createTask).not.toHaveBeenCalled();
  });
  it("creates authenticated scheduled tasks and treats duplicate IDs as success", async () => {
    const queue = new GoogleJobQueue(config);
    const job = {
      id: "stable-id",
      path: "/api/v1/internal/jobs/notifications/deliver",
      payload: { id: "delivery" },
      runAt: new Date("2030-01-01")
    };
    await queue.enqueue(job);
    const task = createTask.mock.calls[0][0].task;
    expect(task.httpRequest.oidcToken).toEqual({
      serviceAccountEmail: values.GCP_JOBS_SERVICE_ACCOUNT,
      audience: values.GCP_JOBS_AUDIENCE
    });
    expect(JSON.parse(task.httpRequest.body.toString())).toEqual(job.payload);
    expect(task.scheduleTime.seconds).toBe(1893456000);
    createTask.mockRejectedValueOnce({ code: 6 });
    await expect(queue.enqueue(job)).resolves.toContain("stable-id");
    createTask.mockRejectedValueOnce({ code: 7 });
    await expect(queue.enqueue(job)).rejects.toEqual({ code: 7 });
    await expect(queue.enqueue({ ...job, path: "https://other.example" })).rejects.toThrow("Invalid job path");
    await expect(queue.enqueue({ ...job, id: "../other" })).rejects.toThrow("Invalid task ID");
    deleteTask.mockRejectedValueOnce({ code: 5 });
    await queue.cancel(job.id);
    deleteTask.mockRejectedValueOnce({ code: 7 });
    await expect(queue.cancel(job.id)).rejects.toEqual({ code: 7 });
  });
  it("updates schedules and only creates them when absent", async () => {
    const scheduler = new GoogleJobScheduler(config);
    const job = {
      id: "sweep",
      schedule: "* * * * *",
      timeZone: "America/Guatemala",
      path: "/api/v1/internal/jobs/notifications/dispatch",
      payload: {}
    };
    await scheduler.upsert(job);
    expect(createJob).not.toHaveBeenCalled();
    updateJob.mockRejectedValueOnce({ code: 5 });
    await scheduler.upsert(job);
    expect(createJob).toHaveBeenCalledWith(
      expect.objectContaining({ parent: "projects/blue-test/locations/us-central1" })
    );
    updateJob.mockRejectedValueOnce({ code: 7 });
    await expect(scheduler.upsert(job)).rejects.toEqual({ code: 7 });
    deleteJob.mockRejectedValueOnce({ code: 5 });
    await scheduler.remove("sweep");
    await expect(scheduler.upsert({ ...job, path: "//other.example" })).rejects.toThrow();
    await expect(new GoogleJobScheduler(new ConfigService({})).remove("sweep")).rejects.toThrow("disabled");
  });
});
describe("GoogleJobGuard", () => {
  const context = (authorization?: string) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization, "x-cloudscheduler": "true" } }) })
    }) as ExecutionContext;
  it("rejects spoofed Google headers, absent credentials and disabled jobs", async () => {
    await expect(new GoogleJobGuard(new ConfigService({})).canActivate(context("Bearer fake"))).rejects.toThrow();
    await expect(new GoogleJobGuard(new ConfigService(values)).canActivate(context())).rejects.toThrow();
  });
  it("accepts only a Google-verified token with the configured audience and verified email", async () => {
    const guard = new GoogleJobGuard(new ConfigService(values));
    verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ email: values.GCP_JOBS_SERVICE_ACCOUNT, email_verified: true })
    });
    expect(await guard.canActivate(context("Bearer signed"))).toBe(true);
    expect(verifyIdToken).toHaveBeenCalledWith({ idToken: "signed", audience: values.GCP_JOBS_AUDIENCE });
    verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ email: "attacker@example.com", email_verified: true })
    });
    await expect(guard.canActivate(context("Bearer other"))).rejects.toThrow();
    verifyIdToken.mockRejectedValueOnce(new Error("bad signature"));
    await expect(guard.canActivate(context("Bearer invalid"))).rejects.toThrow();
  });
});
