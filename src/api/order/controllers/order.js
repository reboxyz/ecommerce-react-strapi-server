"use strict";
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

/**
 * order controller
 * Note! Add customization to process strapi orders and stripe API
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  async create(ctx) {
    const { products, userName, email } = ctx.request.body;
    try {
      // Retrieve item information from the DB for security best practice using the ID passed from the client coz we could not trust the client
      const lineItems = await Promise.all(
        products.map(async (product) => {
          const item = await strapi
            .service("api::item.item")
            .findOne(product.id);

          // Note! This structure is according to stripe docs using the 'prebuilt checkout' flow. The other type is 'custom' but more involved.
          // The 'prebuilt' does not need customization
          return {
            price_data: {
              currency: "usd",
              product_data: {
                name: item.name,
              },
              unit_amount: item.price * 100,
            },
            quantity: product.count,
          };
        })
      );

      // Create a stripe session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        customer_email: email,
        mode: "payment",
        success_url: "http://localhost:3000/checkout/success",
        cancel_url: "http://localhost:3000",
        line_items: lineItems,
      });

      // create the item in the strapi backend
      await strapi.service("api::order.order").create({
        data: { userName, products, stripeSessionId: session.id },
      });

      // return the session id
      return { id: session.id };
    } catch (error) {
      console.log("error", error);
      ctx.response.status = 500;
      return { error: { message: "There was a problem creating the charge." } };
    }
  },
}));
