import { GoogleGenerativeAI } from "./genai.js";
const API_KEY = "AIzaSyC67lFXom93k3b1UT8pBqhLQRwumPGC5Ws";
const genAI = new GoogleGenerativeAI(API_KEY);

async function sendRequestWithDelay(userPrompt, questionIndex) {
    console.log("Sending request for question:", userPrompt); // Логируем запрос
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(`${userPrompt} without explanation just correct answer`);
        const response = await result.response;
        const text = await response.text(); // Получаем правильный ответ
        console.log("Correct answer from API:", text); // Логируем ответ от API

        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            const tab = tabs[0];
            if (tab) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: insertCorrectAnswer,
                    args: [text.trim(), questionIndex] // Передаем правильный ответ и индекс вопроса
                });
            }
        });
    } catch (error) {
        console.error("Error in sendRequestWithDelay:", error);
        if (error.response && error.response.status === 429) {
            console.error("Too many requests. Retrying...");
            await new Promise(resolve => setTimeout(resolve, 5000));
            sendRequestWithDelay(userPrompt, questionIndex); // Перезапускаем запрос
        } else {
            alert("Произошла ошибка при обработке запроса. Попробуйте позже.");
        }
    }
}

const clickBtn = document.getElementById("clickButton");
clickBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const tab = tabs[0];
        if (tab) {
            execScript(tab);
        } else {
            alert("There are no active tabs");
        }
    });
});

function execScript(tab) {
    chrome.scripting.executeScript(
        {
            target: { tabId: tab.id },
            func: findQuestionsAndAnswers
        },
        onResult
    );
}

function findQuestionsAndAnswers() {
    const questions = document.querySelectorAll(".test-question");
    console.log("Found questions:", questions.length); // Логируем количество найденных вопросов
    const results = Array.from(questions).map((question) => {
        const questionText = question.textContent.trim();
        const answers = Array.from(
            question.closest(".test-table").querySelectorAll(".test-answers > li > label")
        ).map(label => label.textContent.trim());

        return {
            question: questionText,
            answers: answers
        };
    });

    return results;
}

function onResult(frames) {
    if (!frames || frames.length === 0 || !frames[0].result) {
        const errorDiv = document.createElement("div");
        errorDiv.textContent = "No questions or answers found with the given structure.";
        errorDiv.style.color = "red";
        document.body.appendChild(errorDiv);
        return;
    }

    const results = frames[0].result;

    // Отправляем запросы для каждого вопроса, передавая индекс
    results.forEach((result, index) => {
        const userPrompt = `Question: ${result.question}\nAnswers: ${result.answers.join(", ")}`;
        sendRequestWithDelay(userPrompt, index); // Передаем индекс вопроса
    });
}

function insertCorrectAnswer(correctAnswerText, questionIndex) {
    console.log("Inserting correct answer:", correctAnswerText); // Логируем правильный ответ
    const match = correctAnswerText.match(/^(\w)/); // Находим первую букву в строке
    const correctAnswer = match ? match[1].trim() : ''; // Извлекаем первую букву

    const questionElements = document.querySelectorAll(".test-question");
    if (questionElements.length === 0) {
        console.error("No questions found on the page.");
        return;
    }

    const questionElement = questionElements[questionIndex];
    if (!questionElement) {
        console.error(`Question element not found for index ${questionIndex}`);
        return;
    }

    console.log("Found question element:", questionElement);

    const answerElements = questionElement.closest(".test-table")?.querySelectorAll(".test-answers > li > label");
    if (!answerElements || answerElements.length === 0) {
        console.error("No answer elements found for question:", questionElement.textContent);
        return;
    }

    let answerFound = false;

    answerElements.forEach((answerElement) => {
        const answerText = answerElement.textContent.trim();
        console.log("Checking answer:", answerText); // Логируем каждый вариант ответа

        // Если правильный ответ совпадает с вариантом
        if (answerText.startsWith(correctAnswer)) {
            console.log("Correct answer matched:", answerText); // Логируем совпадение

            // Добавляем обработчики событий для изменения цвета при наведении
            answerElement.onmouseenter = () => {
                console.log("Mouse entered correct answer.");
                answerElement.style.color = 'red'; // Меняем цвет при наведении
                answerElement.style.cursor = 'pointer'; // Меняем курсор
            };

            answerElement.onmouseleave = () => {
                console.log("Mouse left correct answer.");
                answerElement.style.color = ''; // Возвращаем исходный цвет
                answerElement.style.cursor = 'default';
            };

            answerFound = true;
        }
    });

    // Если правильный ответ не найден среди вариантов, выводим его менее заметно
    if (!answerFound) {
    console.warn("Correct answer not found in options. Displaying it manually.");
    const correctAnswerDisplay = document.createElement("div");
    correctAnswerDisplay.textContent = `Correct answer: ${correctAnswerText.trim()}`;
    correctAnswerDisplay.style.color = "green";
    correctAnswerDisplay.style.fontSize = "12px"; // Меньший размер шрифта
    correctAnswerDisplay.style.opacity = "0"; // Изначально скрыт
    correctAnswerDisplay.style.marginTop = "10px";
    correctAnswerDisplay.style.fontStyle = "italic"; // Курсив для меньшей заметности
    correctAnswerDisplay.style.transition = "opacity 0.3s ease"; // Плавное изменение прозрачности

    // Добавляем обработчик события для появления правильного ответа при наведении на вопрос
    questionElement.addEventListener("mouseenter", () => {
        correctAnswerDisplay.style.opacity = "1"; // Показать правильный ответ
    });

    // Добавляем обработчик события для скрытия правильного ответа при уходе курсора с вопроса
    questionElement.addEventListener("mouseleave", () => {
        correctAnswerDisplay.style.opacity = "0"; // Скрыть правильный ответ
    });

    questionElement.appendChild(correctAnswerDisplay); // Добавляем правильный ответ в конец вопроса
}

}
