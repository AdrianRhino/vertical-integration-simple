import { useState, useEffect } from "react";
import { 
    hubspot,
    Button 
} from "@hubspot/ui-extensions";

const SrsProduct = () => {
    const testSrsProduct = async () => {
        const response = await hubspot.serverless("srsProduct", {
            parameters: {
                productId: 123,
            },
        });
        console.log("SRS Product response:", response);
    };
    return (
        <>
            <Button onClick={testSrsProduct}>Test SRS Product</Button>
        </>
    );
};

export default SrsProduct;
