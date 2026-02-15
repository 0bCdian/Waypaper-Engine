---
name: selenium-automation
description: Expert guidance for browser automation and web testing using Selenium WebDriver with best practices for element location, waits, and test organization.
---

# Selenium Browser Automation

You are an expert in Selenium WebDriver, browser automation, web testing, and building reliable automated test suites for web applications.

## Core Expertise
- Selenium WebDriver architecture and browser drivers
- Element location strategies (ID, CSS, XPath, link text)
- Explicit and implicit waits for dynamic content
- Page Object Model (POM) design pattern
- Cross-browser testing with Chrome, Firefox, Safari, Edge
- Headless browser execution
- Integration with pytest, unittest, and other test frameworks
- Grid deployment for parallel test execution

## Key Principles

- Write maintainable, readable test code following PEP 8 style guidelines
- Implement the Page Object Model pattern for code reusability
- Use explicit waits instead of implicit waits or hard-coded sleeps
- Design tests for independence and isolation
- Handle dynamic content and asynchronous operations properly
- Follow DRY principles with helper functions and base classes

## Project Structure

```
tests/
    conftest.py
    pages/
        __init__.py
        base_page.py
        login_page.py
        dashboard_page.py
    tests/
        __init__.py
        test_login.py
        test_dashboard.py
    utils/
        __init__.py
        driver_factory.py
        config.py
```

## WebDriver Setup

### Driver Factory Pattern
```python
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service

def create_driver(browser='chrome', headless=False):
    if browser == 'chrome':
        options = Options()
        if headless:
            options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        service = Service(ChromeDriverManager().install())
        return webdriver.Chrome(service=service, options=options)
    # Add other browsers as needed
```

### Pytest Fixtures
```python
import pytest
from utils.driver_factory import create_driver

@pytest.fixture(scope='function')
def driver():
    driver = create_driver(headless=True)
    driver.implicitly_wait(10)
    yield driver
    driver.quit()
```

## Page Object Model

### Base Page Class
```python
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class BasePage:
    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, 10)

    def find_element(self, locator):
        return self.wait.until(EC.presence_of_element_located(locator))

    def click_element(self, locator):
        element = self.wait.until(EC.element_to_be_clickable(locator))
        element.click()

    def enter_text(self, locator, text):
        element = self.find_element(locator)
        element.clear()
        element.send_keys(text)
```

### Page Object Implementation
```python
from selenium.webdriver.common.by import By
from pages.base_page import BasePage

class LoginPage(BasePage):
    # Locators
    USERNAME_INPUT = (By.ID, 'username')
    PASSWORD_INPUT = (By.ID, 'password')
    LOGIN_BUTTON = (By.CSS_SELECTOR, 'button[type="submit"]')
    ERROR_MESSAGE = (By.CLASS_NAME, 'error-message')

    def __init__(self, driver):
        super().__init__(driver)
        self.url = '/login'

    def login(self, username, password):
        self.enter_text(self.USERNAME_INPUT, username)
        self.enter_text(self.PASSWORD_INPUT, password)
        self.click_element(self.LOGIN_BUTTON)

    def get_error_message(self):
        return self.find_element(self.ERROR_MESSAGE).text
```

## Element Location Strategies

### Preferred Order (Most to Least Reliable)
1. **ID** - Most reliable when available
2. **Name** - Good for form elements
3. **CSS Selector** - Fast and readable
4. **XPath** - Powerful but can be brittle
5. **Link Text** - For anchor elements
6. **Class Name** - Avoid if class changes frequently

### CSS Selector Best Practices
```python
# Good: Specific, stable selectors
By.CSS_SELECTOR, 'form#login input[name="username"]'
By.CSS_SELECTOR, '[data-testid="submit-button"]'

# Avoid: Fragile selectors
By.CSS_SELECTOR, 'div > div > div > button'  # Too structural
By.CSS_SELECTOR, '.btn-primary'  # Class might change
```

### XPath Best Practices
```python
# Use for complex relationships
By.XPATH, '//label[text()="Email"]/following-sibling::input'
By.XPATH, '//table//tr[contains(., "John")]//button[@class="edit"]'
```

## Waits and Synchronization

### Explicit Waits (Preferred)
```python
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

wait = WebDriverWait(driver, 10)

# Wait for element to be clickable
element = wait.until(EC.element_to_be_clickable((By.ID, 'button')))

# Wait for element to be visible
element = wait.until(EC.visibility_of_element_located((By.ID, 'modal')))

# Wait for text to be present
wait.until(EC.text_to_be_present_in_element((By.ID, 'status'), 'Complete'))

# Custom wait condition
wait.until(lambda d: d.find_element(By.ID, 'count').text == '5')
```

### Common Expected Conditions
- `presence_of_element_located` - Element exists in DOM
- `visibility_of_element_located` - Element is visible
- `element_to_be_clickable` - Element is visible and enabled
- `staleness_of` - Element is no longer attached to DOM
- `frame_to_be_available_and_switch_to_it` - Frame is available

## Test Writing Best Practices

### Test Structure
```python
import pytest
from pages.login_page import LoginPage
from pages.dashboard_page import DashboardPage

class TestLogin:
    @pytest.fixture(autouse=True)
    def setup(self, driver):
        self.driver = driver
        self.login_page = LoginPage(driver)
        self.dashboard_page = DashboardPage(driver)

    def test_successful_login(self):
        """Verify user can login with valid credentials"""
        self.driver.get('https://example.com/login')
        self.login_page.login('valid_user', 'valid_pass')
        assert self.dashboard_page.is_displayed()

    def test_invalid_password_shows_error(self):
        """Verify error message displays for invalid password"""
        self.driver.get('https://example.com/login')
        self.login_page.login('valid_user', 'wrong_pass')
        assert 'Invalid credentials' in self.login_page.get_error_message()
```

### Test Naming Conventions
- Use descriptive names: `test_login_with_valid_credentials_redirects_to_dashboard`
- Include the action and expected outcome
- Group related tests in classes

## Handling Special Elements

### Dropdowns
```python
from selenium.webdriver.support.ui import Select

select = Select(driver.find_element(By.ID, 'country'))
select.select_by_visible_text('United States')
select.select_by_value('us')
select.select_by_index(1)
```

### Alerts
```python
alert = driver.switch_to.alert
alert.accept()  # Click OK
alert.dismiss()  # Click Cancel
alert.send_keys('input text')  # Type in prompt
```

### Frames
```python
driver.switch_to.frame('frame_name')
# Or by element
frame = driver.find_element(By.ID, 'myframe')
driver.switch_to.frame(frame)
# Return to main content
driver.switch_to.default_content()
```

### Multiple Windows
```python
original_window = driver.current_window_handle
# Click link that opens new window
for handle in driver.window_handles:
    if handle != original_window:
        driver.switch_to.window(handle)
        break
# Return to original
driver.switch_to.window(original_window)
```

## Performance and Reliability

- Run tests in headless mode for faster execution
- Use parallel execution with pytest-xdist
- Implement retry logic for flaky tests
- Take screenshots on failure for debugging
- Use WebDriverWait instead of time.sleep()

## Key Dependencies

- selenium
- webdriver-manager
- pytest
- pytest-xdist (parallel execution)
- pytest-html (HTML reports)
- allure-pytest (advanced reporting)

## Configuration

```python
# pytest.ini
[pytest]
addopts = -v --html=reports/report.html
markers =
    smoke: Quick smoke tests
    regression: Full regression tests
```

## Debugging Tips

- Enable browser developer tools in non-headless mode
- Use `driver.save_screenshot('debug.png')` for visual debugging
- Print page source: `print(driver.page_source)`
- Use breakpoints with `import pdb; pdb.set_trace()`
