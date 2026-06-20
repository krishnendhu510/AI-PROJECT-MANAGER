import os
import json

from groq import Groq
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Create Groq client
client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)

def extract_task_info(user_input):

    prompt = f"""
Extract:

- project
- task
- deadline
- priority

Priority can be:
High
Medium
Low

If no project is mentioned,
generate a suitable project name.

Return ONLY valid JSON.

Example:

{{
  "project": "Ecommerce",
  "task": "Fix payment API",
  "deadline": "tomorrow",
  "priority": "High"
}}

User Input:
{user_input}
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0
    )

    content = response.choices[0].message.content

    # Remove markdown formatting if present
    content = content.replace("```json", "")
    content = content.replace("```", "")
    content = content.strip()

    return json.loads(content)