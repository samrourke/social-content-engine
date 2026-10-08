import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const instagramAccessToken = process.env.INSTAGRAM_ACCESS_TOKEN; // Add this line to get the Instagram access token from the environment variables

if (!supabaseUrl || !serviceRoleKey || !instagramAccessToken) {
  throw new Error(
    "Missing Supabase credentials or Instagram access token in environment variables",
  );
}

console.log("<<<<<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>");
console.log("RUNNING INSTAGRAM SEARCH SCRIPT");
console.log("Today's Date: " + new Date().toString());
console.log("<<<<<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>");

const supabase = createClient(supabaseUrl, serviceRoleKey);

const SEARCH_QUERIES = ["circawaves", "desired", "search", "queries"]; // Replace with your desired search query

//Function to search Instagram for posts based on a query

//Function to get current supabase table

//function to update supabase table with new data
