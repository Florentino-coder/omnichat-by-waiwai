# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: playwright-smoke.spec.ts >> OmniChat Post-Deploy Smoke Test >> Priority 3: Frontend Inbox Refactor UI Tests
- Location: playwright-smoke.spec.ts:30:7

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]: CW
        - generic [ref=e6]:
          - paragraph [ref=e7]: Chat-Wai
          - paragraph [ref=e8]: Customer service workspace
      - generic [ref=e9]:
        - generic [ref=e10]:
          - generic [ref=e11]:
            - heading "Select workspace" [level=1] [ref=e12]
            - paragraph [ref=e13]: Choose active tenant workspace for this session.
          - button "Cancel" [active] [ref=e14] [cursor=pointer]
        - generic [ref=e16]:
          - generic [ref=e17]:
            - heading "สร้างองค์กรใหม่" [level=2] [ref=e18]
            - paragraph [ref=e19]: สร้าง Tenant และ Workspace เริ่มต้นสำหรับจัดการแชทของคุณ
          - generic [ref=e20]:
            - text: ชื่อองค์กร / บริษัท
            - textbox "ชื่อองค์กร / บริษัท" [ref=e21]:
              - /placeholder: เช่น Acme Corp หรือ ร้านป้าสมศรี
          - button "สร้างและเริ่มใช้งาน" [ref=e22] [cursor=pointer]
  - alert [ref=e23]
```