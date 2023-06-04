"use strict";
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

/**
 * order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  async create(ctx) {
    const {
      products,
      userName,
      email,
      phoneNumber,
      billingAddress,
      shippingAddress,
    } = ctx.request.body;

    // Check if billingAddress and shippingAddress are defined
    if (!billingAddress || !shippingAddress) {
      return ctx.throw(400, 'Both billingAddress and shippingAddress are required');
    }

    try {
      // retrieve item information
      const lineItems = await Promise.all(
        products.map(async (product) => {
          const item = await strapi
            .service("api::item.item")
            .findOne(product.id);

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

      // create a stripe session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        customer_email: email,
        mode: "payment",
        success_url: "http://localhost:3000/checkout/success",
        cancel_url: "http://localhost:3000",
        line_items: lineItems,
        metadata: {
          shippingAddress: JSON.stringify(shippingAddress),
          billingAddress: JSON.stringify(billingAddress),
          phoneNumber: phoneNumber,
        },
      });

      // create the order
      await strapi
        .service("api::order.order")
        .create({
          data: {
            userName,
            products,
            stripeSessionId: session.id,
            email,
            phoneNumber,
            billingLastName: billingAddress.lastName,
            billingFirstName: billingAddress.firstName,
            billingCountry: billingAddress.country,
            billingstreet1: billingAddress.street1,
            billingStreet2: billingAddress.street2,
            billingCity: billingAddress.city,
            billingState: billingAddress.state,
            billingZipCode: billingAddress.zipCode,
            shippingLastName: shippingAddress.lastName,
            shippingFirstName: shippingAddress.firstName,
            shippingCountry: shippingAddress.country,
            shippingstreet1: shippingAddress.street1,
            shippingStreet2: shippingAddress.street2,
            shippingCity: shippingAddress.city,
            shippingState: shippingAddress.state,
            shippingZipCode: shippingAddress.zipCode,
          },
        });

      // return the session id
      return { id: session.id };
    } catch (error) {
      console.error("Error in order controller:", error);
      ctx.response.status = 500;
      return { error: { message: "There was a problem creating the charge" } };
    }
  },
}));