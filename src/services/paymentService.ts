import repositoryFabric from "../infrastructure/repository/repositoryFabric";
import { PaymentPromiseSchema } from "../infrastructure/schema/payment.schema";
import { logger } from "../logger";
import { PaymentRecord } from "../shared/types/repository";

const paymentService = {
  createPaymentRecord: async function ({
    userId,
    product,
    amount,
    screenshotPath,
  }: PaymentRecord) {
    try {
      const res = await repositoryFabric.payment.create({
        userId,
        screenshotPath,
        amount,
        product,
      });
      logger.info(
        { userId, product, amount, screenshotPath },
        "Payment record created"
      );

      return res[0];
    } catch (err: any) {
      console.log(err.message);
    }
  },

  updatePaymentAmount: async function (
    paymentId: string,
    amount: number,
    reserve?: boolean,
    complete?: boolean
  ) {
    try {
      const req = await repositoryFabric.payment.updateAmount(
        paymentId,
        amount,
        reserve ? reserve : false
      );

      if (complete) {
        const changeReserve = await repositoryFabric.payment.updateReserve(
          req[0].userId,
          false
        );

        req.push(changeReserve[0])
      }

      logger.info({ paymentId, amount }, "Updated payment amount in DB");
      return req;
    } catch (err: any) {
      console.log(err.message);
      throw new Error("Error update payment amount");
    }
  },

  getPaymentById: async function (
    paymentId: string
  ): Promise<Array<PaymentPromiseSchema> | null> {
    logger.info({ paymentId }, "Getting payment record by id");
    try {
      const rows = await repositoryFabric.payment.getById(paymentId);
      console.info(`getById: ${JSON.stringify(rows)}`);
      return rows;
    } catch (err: any) {
      console.log(err.message);
      return null;
    }
  },

  getReservedPayment: async function (
    paymentId: string,
    product: string
  ): Promise<PaymentPromiseSchema | null> {
    logger.info({ paymentId }, "Check payment reserve by id");
    try {
      const req = await repositoryFabric.payment.get(paymentId, product);

      const row = req?.find(
        (row) => row.product === "course" && row.isReserve === true
      );

      if (!row) return null;
      logger.info("Find reserved payment", row);

      return row;
    } catch (err: any) {
      logger.error(err, "Something wrong when checking reserved payment");
      return null;
    }
  },

  clearPaymentScreenshot: async function (paymentId: string) {
    try {
      await repositoryFabric.payment.updateImgPath(paymentId);
      logger.info({ paymentId }, "Cleared payment screenshot path in DB");
    } catch (err: any) {
      console.log(err.message);
    }
  },
};

export default paymentService;
