import { FastifyInstance } from "fastify";
import { gitService } from "./git.service.js";

export async function gitRoutes(app: FastifyInstance) {
  // 1. Get current Git Status
  app.get("/api/git/status", async (req, reply) => {
    try {
      const data = await gitService.getStatus();
      return data;
    } catch (err: any) {
      return reply
        .status(500)
        .send({ error: err.message || "Erro ao obter status do Git" });
    }
  });

  // 2. Get Git Log / Commits history
  app.get("/api/git/log", async (req, reply) => {
    try {
      const { limit } = req.query as { limit?: string };
      const data = await gitService.getLog(limit ? parseInt(limit, 10) : 20);
      return data;
    } catch (err: any) {
      return reply
        .status(500)
        .send({ error: err.message || "Erro ao obter histórico de commits" });
    }
  });

  // 3. Get Branches
  app.get("/api/git/branches", async (req, reply) => {
    try {
      const data = await gitService.getBranches();
      return data;
    } catch (err: any) {
      return reply
        .status(500)
        .send({ error: err.message || "Erro ao listar branches" });
    }
  });

  // 4. Create or Switch Branch
  app.post("/api/git/branch", async (req, reply) => {
    try {
      const { branch } = req.body as { branch: string };
      if (!branch) {
        return reply
          .status(400)
          .send({ error: "Nome da branch é obrigatório" });
      }
      const res = await gitService.switchOrCreateBranch(branch);
      return res;
    } catch (err: any) {
      return reply
        .status(500)
        .send({ error: err.message || "Erro ao trocar de branch" });
    }
  });

  // 5. Commit changes
  app.post("/api/git/commit", async (req, reply) => {
    try {
      const { message, files } = req.body as {
        message: string;
        files?: string[];
      };
      if (!message || !message.trim()) {
        return reply
          .status(400)
          .send({ error: "Mensagem de commit é obrigatória" });
      }
      const res = await gitService.commit(message.trim(), files);
      return res;
    } catch (err: any) {
      return reply
        .status(500)
        .send({ error: err.message || "Erro ao realizar commit" });
    }
  });

  // 6. Sync with remote (Push/Pull)
  app.post("/api/git/sync", async (req, reply) => {
    try {
      const { branch } = (req.body as { branch?: string }) || {};
      const res = await gitService.sync(branch);
      return res;
    } catch (err: any) {
      return reply
        .status(500)
        .send({ error: err.message || "Erro ao sincronizar com remote" });
    }
  });

  // 7. Get File Blame
  app.get("/api/git/blame", async (req, reply) => {
    try {
      const { path } = req.query as { path: string };
      if (!path) {
        return reply
          .status(400)
          .send({ error: "Caminho do arquivo é obrigatório" });
      }
      const res = await gitService.getBlame(path);
      return res;
    } catch (err: any) {
      return reply
        .status(500)
        .send({ error: err.message || "Erro ao obter blame do arquivo" });
    }
  });

  // 8. Get Specific File History (Commits)
  app.get("/api/git/file-history", async (req, reply) => {
    try {
      const { path, limit } = req.query as { path: string; limit?: string };
      if (!path) {
        return reply
          .status(400)
          .send({ error: "Caminho do arquivo é obrigatório" });
      }
      const res = await gitService.getFileHistory(
        path,
        limit ? parseInt(limit, 10) : 30,
      );
      return res;
    } catch (err: any) {
      return reply
        .status(500)
        .send({ error: err.message || "Erro ao obter histórico do arquivo" });
    }
  });

  // 9. Get Specific File Content at Historical Commit
  app.get("/api/git/file-version", async (req, reply) => {
    try {
      const { path, hash } = req.query as { path: string; hash: string };
      if (!path || !hash) {
        return reply
          .status(400)
          .send({ error: "Parâmetros path e hash são obrigatórios" });
      }
      const res = await gitService.getFileVersion(path, hash);
      return res;
    } catch (err: any) {
      return reply
        .status(500)
        .send({ error: err.message || "Erro ao obter versão do arquivo" });
    }
  });

  // 10. Get File / Working Tree Diff
  app.get("/api/git/diff", async (req, reply) => {
    try {
      const { path } = req.query as { path?: string };
      const data = await gitService.getDiff(path);
      return data;
    } catch (err: any) {
      return reply
        .status(500)
        .send({ error: err.message || "Erro ao obter diff do Git" });
    }
  });

  // 11. Get Whats New Summary
  app.get("/api/git/whats-new", async (req, reply) => {
    try {
      const { lastSeenHash } = req.query as { lastSeenHash?: string };
      const data = await gitService.getWhatsNew(lastSeenHash);
      return data;
    } catch (err: any) {
      return reply
        .status(500)
        .send({ error: err.message || "Erro ao obter novidades d" });
    }
  });

  // 12. Get Whats New Single File Diff
  app.get("/api/git/whats-new-diff", async (req, reply) => {
    try {
      const { path: filePath, lastSeenHash } = req.query as {
        path: string;
        lastSeenHash?: string;
      };
      if (!filePath) {
        return reply
          .status(400)
          .send({ error: "Parâmetro path é obrigatório" });
      }
      const data = await gitService.getWhatsNewDiff(filePath, lastSeenHash);
      return data;
    } catch (err: any) {
      return reply
        .status(500)
        .send({
          error: err.message || "Erro ao obter comparativo do documento",
        });
    }
  });

  // 13. Get Git Diagnostic / Version
  app.get("/api/git/diagnostic", async (req, reply) => {
    try {
      const res = await gitService.getGitVersion();
      return res;
    } catch (err: any) {
      return reply
        .status(500)
        .send({ error: err.message || "Erro ao diagnosticar Git" });
    }
  });
}
