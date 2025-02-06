const express = require("express");
const router = express.Router();
const Cart = require("../models/cartmodel");

// Add to Cart Route
router.post("/addtocart", async (req, res) => {
	try {
		const { cartId, productsInCart, userId } = req.body;

		if (!Array.isArray(productsInCart)) {
			return res
				.status(400)
				.json({ success: false, message: "productsInCart must be an array" });
		}

		let cart = await Cart.findOne({ userId });

		if (!cart) {
			cart = new Cart({ userId, cartId, productsInCart });
			await cart.save();
			return res.status(200).json({
				success: true,
				message: "Cart created and product added.",
				cart,
			});
		}

		// Create a map of existing products by productId
		const updatedProductsMap = cart.productsInCart.reduce((acc, item) => {
			acc[item.productId] = item;
			return acc;
		}, {});

		// Update quantities for existing products or add new ones
		productsInCart.forEach((newItem) => {
			if (updatedProductsMap[newItem.productId]) {
				updatedProductsMap[newItem.productId].productQty = newItem.productQty;
			} else {
				updatedProductsMap[newItem.productId] = newItem;
			}
		});

		// Convert map back to array
		cart.productsInCart = Object.values(updatedProductsMap);
		await cart.save();

		res
			.status(200)
			.json({ success: true, message: "Cart updated successfully", cart });
	} catch (error) {
		console.error(error);
		res.status(500).json({
			success: false,
			message: "Error adding product to cart",
			error: error.message,
		});
	}
});
// Get All Cart Items
router.get("/cart-items", async (req, res) => {
	console.log("GET /cart-item", req);

	try {
		const cartItems = await Cart.find();
		return res
			.status(200)
			.json({ success: true, message: "All cart items", cartItems });
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, message: "Fetching failed" });
	}
});

// Get Cart by User ID or Cart ID
router.post("/get-cart", async (req, res) => {
	try {
		const { userId, cartId } = req.body;
		if (userId) {
			const cart = await Cart.find({ userId });
			if (!cart) {
				return res
					.status(404)
					.json({ success: false, message: "Cart not found for this user" });
			}
			res
				.status(200)
				.json({ success: true, cart, message: "Cart found successfully" });
		} else if (cartId) {
			const cart = await Cart.findOne({ cartId });
			if (!cart) {
				return res
					.status(404)
					.json({ success: false, message: "Cart not found for this user" });
			}
			res
				.status(200)
				.json({ success: true, cart, message: "Cart found successfully" });
		} else {
			return res
				.status(400)
				.json({ success: false, message: "userId or cartId is required." });
		}
	} catch (error) {
		console.error(error);
		res.status(500).json({
			success: false,
			message: "Error fetching cart",
			error: error.message,
		});
	}
});

// Update Cart Quantity
router.put("/update-quantity", async (req, res) => {
	console.log("Received request body:", req.body);

	try {
		const { userId, productId, productQty } = req.body;

		if (!userId || !productId || typeof productQty !== "number") {
			return res.status(400).json({
				message: "userId, productId, and a valid productQty are required.",
			});
		}

		// Find the user's cart
		const cart = await Cart.findOne({ userId });

		if (!cart) {
			return res.status(404).json({ message: "Cart not found." });
		}

		// Find the product inside the cart
		const productIndex = cart.productsInCart.findIndex(
			(item) => item.productId === productId
		);

		if (productIndex === -1) {
			return res
				.status(404)
				.json({ message: "Product not found in the cart." });
		}

		// ✅ Update product quantity
		cart.productsInCart[productIndex].productQty = productQty;

		// ✅ Save the cart to persist changes
		await cart.save();

		res
			.status(200)
			.json({ success: true, message: "Quantity updated successfully.", cart });
	} catch (error) {
		console.error("Error updating quantity:", error);
		res
			.status(500)
			.json({ message: "An error occurred while updating the quantity." });
	}
});

// Delete Item from Cart
router.post("/remove-item", async (req, res) => {
	try {
		const { userId, productId } = req.body;
		if (!userId || !productId) {
			return res
				.status(400)
				.json({ message: "userId and productId are required." });
		}

		const result = await Cart.updateOne(
			{ userId },
			{ $pull: { productsInCart: { productId } } }
		);
		if (result.modifiedCount > 0) {
			res
				.status(200)
				.json({ success: true, message: "Item deleted successfully." });
		} else {
			res.status(404).json({ message: "Item not found in the cart." });
		}
	} catch (error) {
		console.error("Error deleting item:", error);
		res
			.status(500)
			.json({ message: "An error occurred while deleting the item." });
	}
});

// Delete Entire Cart
router.delete("/delete-cart", async (req, res) => {
	try {
		const { userId } = req.body;
		if (!userId) {
			return res.status(400).json({ message: "userId is required." });
		}

		const result = await Cart.deleteOne({ userId });
		if (result.deletedCount > 0) {
			res
				.status(200)
				.json({ success: true, message: "Cart deleted successfully." });
		} else {
			res.status(404).json({ message: "Cart not found." });
		}
	} catch (error) {
		console.error("Error deleting cart:", error);
		res
			.status(500)
			.json({ message: "An error occurred while deleting the cart." });
	}
});

module.exports = router;
