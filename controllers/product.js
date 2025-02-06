const express = require("express");
const router = express.Router();
const Product = require("../models/product");
const { v4: uuidv4 } = require("uuid");

// Get All Products
router.get("/", async (req, res) => {
	try {
		const products = await Product.find();
		res.status(200).json({ success: true, products });
	} catch (error) {
		console.error("Error fetching products:", error);
		res
			.status(500)
			.json({ success: false, message: "Error fetching products" });
	}
});

// Get Product by ID
router.get("/:productId", async (req, res) => {
	try {
		const { productId } = req.params;
		const product = await Product.findOne({ productId });

		if (!product) {
			return res
				.status(404)
				.json({ success: false, message: "Product not found" });
		}

		res.status(200).json({ success: true, product });
	} catch (error) {
		console.error("Error fetching product:", error);
		res.status(500).json({ success: false, message: "Error fetching product" });
	}
});

// Add New Product
router.post("/new", async (req, res) => {
	try {
		const {
			name,
			price,
			img,
			category,
			description,
			rating,
			inStockValue,
			soldStockValue,
			visibility,
		} = req.body;
		const productId = uuidv4();

		const newProduct = new Product({
			name,
			price,
			img,
			category,
			description,
			rating,
			productId,
			inStockValue,
			soldStockValue,
			visibility: visibility || "on",
		});

		await newProduct.save();
		res.status(201).json({
			success: true,
			message: "Product created successfully",
			product: newProduct,
		});
	} catch (error) {
		console.error("Error adding product:", error);
		res.status(500).json({ success: false, message: "Error adding product" });
	}
});

// Update Product
router.put("/:productId", async (req, res) => {
	try {
		const { productId } = req.params;
		const updateData = req.body;

		const updatedProduct = await Product.findOneAndUpdate(
			{ productId },
			{ $set: updateData },
			{ new: true }
		);

		if (!updatedProduct) {
			return res
				.status(404)
				.json({ success: false, message: "Product not found" });
		}

		res.status(200).json({
			success: true,
			message: "Product updated successfully",
			product: updatedProduct,
		});
	} catch (error) {
		console.error("Error updating product:", error);
		res.status(500).json({ success: false, message: "Error updating product" });
	}
});

// Delete Product
router.delete("/:productId", async (req, res) => {
	try {
		const { productId } = req.params;
		const deletedProduct = await Product.findOneAndDelete({ productId });

		if (!deletedProduct) {
			return res
				.status(404)
				.json({ success: false, message: "Product not found" });
		}

		res
			.status(200)
			.json({ success: true, message: "Product deleted successfully" });
	} catch (error) {
		console.error("Error deleting product:", error);
		res.status(500).json({ success: false, message: "Error deleting product" });
	}
});

module.exports = router;
