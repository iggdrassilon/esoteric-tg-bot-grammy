import repositoryFabric from "../infrastructure/repository/repositoryFabric";
import { logger } from "../logger";

const metricsService = {
  getSalesSum: async function(scope: string) {
    try {
      const request = await repositoryFabric.metrics.getSalesSum(scope);
      const sum = request.reduce((acc, curr) => acc + curr.sum, 0);
      logger.info(sum, "Fetched sales sum");
      ;
      return sum;
    } catch(err) {
      logger.error(err, "Failed to fetch metrics");
    }
  },
}

export default metricsService;
